// backend/server/roots/admin/adminDiscountsRoutes.ts
import { Router, Response } from 'express';
import { db } from '../../db'; // Corrected path
import {
  couponsPgTable, // ✅ New table for coupons
  discountTypeEnum, // ✅ New enum
  couponScopeEnum, // ✅ New enum
  sellersPgTable, // For relations
  products,       // For relations
  categories,     // For relations
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken';
import { eq, and, gt, lt, sql } from 'drizzle-orm'; // ✅ Added sql for now()
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { z } from 'zod'; // For validation

const adminDiscountsRouter = Router();

// --- Validation Schemas ---
const couponIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Coupon ID must be a number."),
  }),
});

const createCouponSchema = z.object({
  code: z.string().min(3, "Coupon code must be at least 3 characters.").max(255),
  description: z.string().optional().nullable(),
  discountType: z.nativeEnum(discountTypeEnum),
  discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Discount value must be a valid decimal number."),
  minOrderValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Minimum order value must be a valid decimal number.").optional().default("0.00"),
  maxDiscountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Max discount amount must be a valid decimal number.").optional().nullable(),
  startDate: z.string().datetime({ message: "Invalid start date format." }),
  endDate: z.string().datetime({ message: "Invalid end date format." }),
  usageLimit: z.number().int().min(1, "Usage limit must be at least 1.").optional().nullable(),
  perUserLimit: z.number().int().min(1, "Per user limit must be at least 1.").optional().default(1),
  isActive: z.boolean().optional().default(true),
  couponScope: z.nativeEnum(couponScopeEnum).optional().default('all_orders'),
  sellerId: z.number().int().optional().nullable(),
  productId: z.number().int().optional().nullable(),
  categoryId: z.number().int().optional().nullable(),
});

const updateCouponSchema = createCouponSchema.partial().extend({
  // For updates, allow isActive to be passed as string 'true'/'false' from frontend
  isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(),
  // Numeric fields might come as strings from forms
  discountValue: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
  minOrderValue: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
  maxDiscountAmount: z.union([z.string(), z.number().transform(val => String(val))]).optional().nullable(),
  usageLimit: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional().nullable(),
  perUserLimit: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
});


// --- Routes ---

/**
 * ✅ GET /api/admin/discounts - सभी डिस्काउंट कूपन फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDiscountsRouter.get('/', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allCoupons = await db.query.couponsPgTable.findMany({
      with: {
        seller: { columns: { id: true, businessName: true } },
        product: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
    return res.status(200).json(allCoupons);
  } catch (error: any) {
    console.error('❌ Error fetching all coupons for admin:', error);
    return res.status(500).json({ error: 'Failed to fetch all coupons.' });
  }
});

/**
 * ✅ GET /api/admin/discounts/:id - ID द्वारा एकल कूपन फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDiscountsRouter.get('/:id', authorize(['admin']), validateRequest(couponIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);
    const [coupon] = await db.query.couponsPgTable.findMany({
      where: eq(couponsPgTable.id, couponId),
      with: {
        seller: { columns: { id: true, businessName: true } },
        product: { columns: { id: true, name: true } },
        category: { columns: { id: true, name: true } },
      },
    });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }
    return res.status(200).json(coupon);
  } catch (error: any) {
    console.error(`❌ Error fetching coupon with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch coupon.' });
  }
});


/**
 * ✅ POST /api/admin/discounts - नया डिस्काउंट कूपन बनाएं
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDiscountsRouter.post(
  '/',
  authorize(['admin']),
  validateRequest(z.object({ body: createCouponSchema })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const couponData = req.body;

      // Check if coupon code already exists
      const [existingCoupon] = await db.select().from(couponsPgTable).where(eq(couponsPgTable.code, couponData.code));
      if (existingCoupon) {
        return res.status(409).json({ error: 'Coupon with this code already exists.' });
      }

      // Validate scope-specific IDs
      if (couponData.couponScope === 'specific_seller' && !couponData.sellerId) {
        return res.status(400).json({ error: 'sellerId is required for specific_seller coupon scope.' });
      }
      if (couponData.couponScope === 'specific_product' && !couponData.productId) {
        return res.status(400).json({ error: 'productId is required for specific_product coupon scope.' });
      }
      if (couponData.couponScope === 'category' && !couponData.categoryId) {
        return res.status(400).json({ error: 'categoryId is required for category coupon scope.' });
      }

      // Convert date strings to Date objects
      const newCoupon: typeof couponsPgTable.$inferInsert = {
        ...couponData,
        startDate: new Date(couponData.startDate),
        endDate: new Date(couponData.endDate),
        // Ensure numeric fields are correctly handled by Drizzle (numeric type can handle strings directly or need parseFloat)
        discountValue: couponData.discountValue, // Drizzle can handle string for numeric columns
        minOrderValue: couponData.minOrderValue,
        maxDiscountAmount: couponData.maxDiscountAmount || null,
      };

      const [createdCoupon] = await db.insert(couponsPgTable)
        .values(newCoupon)
        .returning();

      return res.status(201).json({ message: "Coupon created successfully.", coupon: createdCoupon });
    } catch (error: any) {
      console.error('❌ Error creating coupon:', error);
      return res.status(500).json({ error: error.message || 'Failed to create coupon.' });
    }
  }
);

/**
 * ✅ PATCH /api/admin/discounts/:id - मौजूदा डिस्काउंट कूपन को अपडेट करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDiscountsRouter.patch(
  '/:id',
  authorize(['admin']),
  validateRequest(couponIdSchema.extend({ body: updateCouponSchema })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const couponId = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(couponId)) {
        return res.status(400).json({ error: 'Invalid coupon ID.' });
      }

      const [existingCoupon] = await db.select().from(couponsPgTable).where(eq(couponsPgTable.id, couponId));
      if (!existingCoupon) {
        return res.status(404).json({ message: "Coupon not found." });
      }

      // Check for duplicate code if code is being updated
      if (updateData.code && updateData.code !== existingCoupon.code) {
        const [duplicateCode] = await db.select().from(couponsPgTable).where(eq(couponsPgTable.code, updateData.code));
        if (duplicateCode) {
          return res.status(409).json({ error: 'A coupon with this code already exists.' });
        }
      }

      // Convert date strings to Date objects if present
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      // Convert numeric strings to numbers if present (for actual DB update if Drizzle needs it)
      if (updateData.discountValue !== undefined) updateData.discountValue = String(updateData.discountValue);
      if (updateData.minOrderValue !== undefined) updateData.minOrderValue = String(updateData.minOrderValue);
      if (updateData.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = String(updateData.maxDiscountAmount);

      const finalUpdateData: Partial<typeof couponsPgTable.$inferInsert> = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Remove undefined values
      Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);

      const [updatedCoupon] = await db.update(couponsPgTable)
        .set(finalUpdateData)
        .where(eq(couponsPgTable.id, couponId))
        .returning();

      if (!updatedCoupon) {
        return res.status(500).json({ message: 'Failed to update coupon.' });
      }

      return res.status(200).json({ message: "Coupon updated successfully.", coupon: updatedCoupon });
    } catch (error: any) {
      console.error(`❌ Error updating coupon with ID ${req.params.id}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update coupon.' });
    }
  }
);


/**
 * ✅ DELETE /api/admin/discounts/:id - डिस्काउंट कूपन को हटाएं
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDiscountsRouter.delete('/:id', authorize(['admin']), validateRequest(couponIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);

    const [deletedCoupon] = await db.delete(couponsPgTable)
      .where(eq(couponsPgTable.id, couponId))
      .returning();

    if (!deletedCoupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    // TODO: यदि यह कूपन किसी सक्रिय ऑर्डर पर लागू होता है, तो उसे कैसे हैंडल किया जाए?
    // आमतौर पर, कूपन को निष्क्रिय कर दिया जाता है बजाय इसके कि उसे डिलीट किया जाए यदि वह अतीत में उपयोग किया गया हो।

    return res.status(200).json({ message: "Coupon deleted successfully.", coupon: deletedCoupon });
  } catch (error: any) {
    console.error(`❌ Error deleting coupon with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete coupon.' });
  }
});

// Export router
export default adminDiscountsRouter;
