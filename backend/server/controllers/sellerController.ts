// backend/src/controllers/sellercontroller.ts
import { Request, Response, NextFunction } from 'express'; // 'request', 'response', 'nextfunction' को सही केस में बदला
import { db } from '../db'; // आपका drizzle db इंस्टेंस
import { sellersPgTable, users, stores, approvalStatusEnum, userRoleEnum } from '../../shared/backend/schema'; // आपके drizzle स्कीमा
import { eq } from 'drizzle-orm';
import { z } from 'zod'; // आपके validation schemas के लिए
// ✅ अपनी zod-schema फाइल के सही पाथ को एडजस्ट करें
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    sellerId?: number | null;
    deliveryBoyId?: number | null;
  };
}

// यदि आपके पास एक async handler utility है, तो उसका उपयोग करें।
// यदि नहीं, तो आपको async/await के लिए try-catch ब्लॉक का उपयोग करना होगा।
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => // 'asynchandler' को 'asyncHandler' और 'promise' को 'Promise' में बदला
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next); // 'promise' को 'Promise' में बदला
  };

// seller प्रोफाइल अपडेट करने के लिए zod स्कीमा (यह sellerprofileedit से आना चाहिए)
// सुनिश्चित करें कि इसमें केवल वे फ़ील्ड शामिल हैं जिन्हें एक सेलर अपडेट कर सकता है
const sellerUpdateSchema = z.object({ // 'sellerupdateschema' को 'sellerUpdateSchema' में बदला
  businessName: z.string().min(3).max(100).optional(), // camelCase
  description: z.string().min(10).max(500).optional(),
  businessAddress: z.string().min(10).max(200).optional(), // camelCase
  city: z.string().min(2).max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  businessPhone: z.string().regex(/^\d{10}$/).optional(), // camelCase
  gstNumber: z.string().max(15).optional(), // camelCase
  bankAccountNumber: z.string().regex(/^\d{9,18}$/).optional(), // camelCase
  ifscCode: z.string().regex(/^[a-zA-Z]{4}0[a-zA-Z0-9]{6}$/).optional(), // 'a-z' को 'a-zA-Z' में बदला
  
  // यहाँ deliveryRadius के लिए स्कीमा को ठीक किया गया है
  deliveryRadius: z.union([
    z.number().int().min(1).max(100),
    z.string().transform(val => {
      const num = parseInt(val, 10); // parseInt में रेडिक्स (base 10) जोड़ा
      return isNaN(num) ? null : num; // यदि NaN है तो null लौटाएँ
    })
  ])
  .optional()
  .nullable() // null और undefined दोनों स्वीकार करें
  .refine(val => val === null || (typeof val === 'number' && !isNaN(val)), { // यह सुनिश्चित करने के लिए कि यह या तो null है या एक वैध नंबर
      message: "Delivery radius must be a valid number or null"
  }),              
    
  // ऊपर के .nullable() के बाद यह हिस्सा अवांछित था, इसे हटा दिया गया है।
  // .nullable(), 

  businessType: z.string().min(2).max(50).optional(), // camelCase
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  // approvalstatus, isactive जैसे एडमिन-विशिष्ट फ़ील्ड यहां शामिल न करें
});

// desc    get current seller profile (authenticated seller)
// route   get /api/sellers/me
// access  private/seller
export const getMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    // 1. 'req' को 'any' कास्ट कर रहे हैं ताकि .user.id पर टाइपस्क्रिप्ट शोर न मचाए
    const authUser = (req as any).user;

    if (!authUser || !authUser.id) {
        res.status(401);
        throw new Error('ओहो! आप अधिकृत नहीं हैं, यूजर आईडी नहीं मिली।');
    }

    // 2. 'findFirst' का उपयोग करना ज्यादा यूनिक और तेज है क्योंकि एक यूजर का एक ही सेलर प्रोफाइल होगा
    const seller = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, authUser.id),
        // आप चाहें तो यहाँ 'with' का उपयोग करके दुकान की और डिटेल्स भी निकाल सकते हैं
    });

    if (seller) {
        // 3. प्रोफेशनल रिस्पॉन्स
        res.status(200).json({
            success: true,
            data: seller
        });
    } else {
        res.status(404);
        throw new Error('क्षमा करें, इस यूजर के लिए कोई सेलर प्रोफाइल नहीं मिला।');
    }
});


// desc    update authenticated seller's own profile
// route   patch /api/sellers/:id
// access  private/seller
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = parseInt(req.params.id, 10);
  
  // 1. TypeScript Fix: (req as any) का उपयोग करके एरर हटाया
  const authUser = (req as any).user;

  if (!authUser || !authUser.id) {
    res.status(401);
    throw new Error('Not authorized, user ID not found.');
  }

  if (isNaN(sellerId)) {
    return res.status(400).json({ success: false, error: 'Invalid seller ID.' });
  }

  // 2. सुरक्षा और अस्तित्व की जांच (एक साथ)
  const existingSeller = await db.query.sellersPgTable.findFirst({ 
    where: eq(sellersPgTable.id, sellerId) 
  });
  
  if (!existingSeller) {
    return res.status(404).json({ success: false, message: 'Seller not found.' });
  }

  if (existingSeller.userId !== authUser.id) {
      res.status(403);
      throw new Error('Not authorized to update another seller\'s profile.');
  }

  // 3. Data Parsing & Sanitization
  const updateData = sellerUpdateSchema.parse(req.body); 

  const finalUpdateData: Partial<typeof sellersPgTable.$inferInsert> = {
    ...updateData,
    updatedAt: new Date(),
    latitude: updateData.latitude ? parseFloat(String(updateData.latitude)) : undefined,
  longitude: updateData.longitude ? parseFloat(String(updateData.longitude)) : undefined,
  };

  // Undefined साफ़ करना
  Object.keys(finalUpdateData).forEach(key => {
    if (finalUpdateData[key as keyof typeof finalUpdateData] === undefined) {
      delete finalUpdateData[key as keyof typeof finalUpdateData];
    }
  });

  let resultSeller: any;

  // 🛑 Transaction: पक्का करें कि Seller और Store दोनों साथ में अपडेट हों
  await db.transaction(async (tx) => {
    
    // 1. SELLERS TABLE UPDATE
    const [sellerResult] = await tx.update(sellersPgTable)
      .set(finalUpdateData)
      .where(eq(sellersPgTable.id, sellerId))
      .returning();
      
    resultSeller = sellerResult;

    // 2. STORES TABLE UPDATE
    const storeUpdateData: Partial<typeof stores.$inferInsert> = {
        storeName: updateData.businessName,
        address: updateData.businessAddress,
        city: updateData.city,
        pincode: updateData.pincode,
        latitude: finalUpdateData.latitude,
        longitude: finalUpdateData.longitude,
        updatedAt: new Date(),
    };
    
    // Undefined साफ़ करना (Stores के लिए)
    Object.keys(storeUpdateData).forEach(key => {
        if (storeUpdateData[key as keyof typeof storeUpdateData] === undefined) {
            delete storeUpdateData[key as keyof typeof storeUpdateData];
        }
    });

    await tx.update(stores)
        .set(storeUpdateData)
        .where(eq(stores.sellerId, sellerId));
  });
  
  if (!resultSeller) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }

  return res.status(200).json({ 
    success: true,
    message: "Seller profile updated successfully.", 
    seller: resultSeller 
  });
});