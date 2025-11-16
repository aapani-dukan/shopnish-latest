// backend/src/controllers/sellerController.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../db'; // आपका Drizzle DB इंस्टेंस
import { sellersPgTable, users, approvalStatusEnum, userRoleEnum } from '../../shared/backend/schema'; // आपके Drizzle स्कीमा
import { eq } from 'drizzle-orm';
import { z } from 'zod'; // आपके validation schemas के लिए

// यदि आपके पास एक async handler utility है, तो उसका उपयोग करें।
// यदि नहीं, तो आपको async/await के लिए try-catch ब्लॉक का उपयोग करना होगा।
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Seller प्रोफाइल अपडेट करने के लिए Zod स्कीमा (यह SellerProfileEdit से आना चाहिए)
// सुनिश्चित करें कि इसमें केवल वे फ़ील्ड शामिल हैं जिन्हें एक सेलर अपडेट कर सकता है
const sellerUpdateSchema = z.object({
  businessName: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  businessAddress: z.string().min(10).max(200).optional(),
  city: z.string().min(2).max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  businessPhone: z.string().regex(/^\d{10}$/).optional(),
  gstNumber: z.string().max(15).optional(),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/).optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
  deliveryRadius: z.union([z.number().int().min(1).max(100), z.string().transform(val => parseInt(val))])
                      .optional()
                      .nullable(), // null और undefined दोनों स्वीकार करें
  businessType: z.string().min(2).max(50).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  // approvalStatus, isActive जैसे एडमिन-विशिष्ट फ़ील्ड यहां शामिल न करें
});

// @desc    Get current seller profile (authenticated seller)
// @route   GET /api/sellers/me
// @access  Private/Seller
export const getMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || !req.user.id) {
        res.status(401);
        throw new Error('Not authorized, user ID not found.');
    }

    const [seller] = await db.query.sellersPgTable.findMany({
        where: eq(sellersPgTable.userId, req.user.id),
    });

    if (seller) {
        res.status(200).json(seller);
    } else {
        res.status(404);
        throw new Error('Seller profile not found for this user.');
    }
});


// @desc    Update authenticated seller's own profile
// @route   PATCH /api/sellers/:id
// @access  Private/Seller
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = parseInt(req.params.id); // URL से सेलर ID

  // सुनिश्चित करें कि लॉग इन यूजर req.user.id आपके authentication middleware से आता है
  if (!req.user || !req.user.id) {
    res.status(401);
    throw new Error('Not authorized, user ID not found.');
  }

  // सुरक्षा जांच: सुनिश्चित करें कि लॉग इन सेलर केवल अपनी खुद की प्रोफ़ाइल अपडेट कर रहा है
  if (req.user.id !== sellerId) { // यदि req.user.id सीधे sellerId है (जैसे Firebase UID)
    // यदि req.user.id यूजर का id है, और sellerId सेलर टेबल का id है
    // तो हमें पहले sellerId से userId निकालना होगा
    const [sellerBeingUpdated] = await db.query.sellersPgTable.findMany({ where: eq(sellersPgTable.id, sellerId) });
    if (!sellerBeingUpdated || sellerBeingUpdated.userId !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized to update another seller\'s profile.');
    }
  }


  const updateData = sellerUpdateSchema.parse(req.body); // zod के साथ रिक्वेस्ट बॉडी को वैलिडेट करें

  if (isNaN(sellerId)) {
    return res.status(400).json({ error: 'Invalid seller ID.' });
  }

  const [existingSeller] = await db.query.sellersPgTable.findMany({ where: eq(sellersPgTable.id, sellerId) });
  if (!existingSeller) {
    return res.status(404).json({ message: 'Seller not found.' });
  }

  const finalUpdateData: Partial<typeof sellersPgTable.$inferInsert> = {
    ...updateData,
    updatedAt: new Date(),
  };

  // Undefined values को हटा दें ताकि वे डेटाबेस में null के रूप में सेट न हों
  Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);

  const [updatedSeller] = await db.update(sellersPgTable)
    .set(finalUpdateData)
    .where(eq(sellersPgTable.id, sellerId))
    .returning();

  if (!updatedSeller) {
    return res.status(500).json({ message: 'Failed to update seller.' });
  }

  return res.status(200).json({ message: "Seller profile updated successfully.", seller: updatedSeller });
});
