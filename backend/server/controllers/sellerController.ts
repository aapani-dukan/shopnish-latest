// backend/src/controllers/sellercontroller.ts
import { Request, Response, NextFunction } from 'express'; // 'request', 'response', 'nextfunction' को सही केस में बदला
import { db } from '../db'; // आपका drizzle db इंस्टेंस
import { sellersPgTable, users, approvalStatusEnum, userRoleEnum } from '../../shared/backend/schema'; // आपके drizzle स्कीमा
import { eq } from 'drizzle-orm';
import { z } from 'zod'; // आपके validation schemas के लिए
// ✅ अपनी zod-schema फाइल के सही पाथ को एडजस्ट करें


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
export const getMySellerProfile = asyncHandler(async (req: Request, res: Response) => { // 'getmysellerprofile' को 'getMySellerProfile' में बदला
    if (!req.user || !req.user.id) {
        res.status(401);
        throw new Error('Not authorized, user ID not found.'); // 'error' को 'Error' में बदला और संदेश में सुधार
    }

    const [seller] = await db.query.sellersPgTable.findMany({ // 'findmany' को 'findMany' में बदला
        where: eq(sellersPgTable.userId, req.user.id), // 'userid' को 'userId' में बदला
    });

    if (seller) {
        res.status(200).json(seller);
    } else {
        res.status(404);
        throw new Error('Seller profile not found for this user.'); // 'error' को 'Error' में बदला और संदेश में सुधार
    }
});


// desc    update authenticated seller's own profile
// route   patch /api/sellers/:id
// access  private/seller
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response) => { // 'updatemysellerprofile' को 'updateMySellerProfile' में बदला
  const sellerId = parseInt(req.params.id, 10); // 'sellerid' को 'sellerId' में बदला और parseInt में रेडिक्स जोड़ा

  // सुनिश्चित करें कि लॉग इन यूजर req.user.id आपके authentication middleware से आता है
  if (!req.user || !req.user.id) {
    res.status(401);
    throw new Error('Not authorized, user ID not found.');
  }

  // सुरक्षा जांच: सुनिश्चित करें कि लॉग इन सेलर केवल अपनी खुद की प्रोफ़ाइल अपडेट कर रहा है
  // यदि req.user.id आपके User मॉडल का ID है, और sellerId आपके Seller मॉडल का ID है,
  // तो आपको पहले sellerId से संबंधित userId को fetch करना होगा।
  // यदि req.user.id सीधे seller के ID को दर्शाता है, तो यह तुलना सीधी हो सकती है।
  // मैं मान रहा हूँ कि req.user.id यूजर का ID है, और sellerId सेलर का ID है।
  const [sellerBeingUpdated] = await db.query.sellersPgTable.findMany({ where: eq(sellerspgtable.id, sellerId) }); // 'findmany' को 'findMany' और 'sellerbeingupdated' को 'sellerBeingUpdated' में बदला
  
  if (!sellerBeingUpdated || sellerBeingUpdated.userId !== req.user.id) { // 'userid' को 'userId' में बदला
      res.status(403);
      throw new Error('Not authorized to update another seller\'s profile or seller not found.'); // संदेश में सुधार
  }


  const updateData = sellerUpdateSchema.parse(req.body); // 'updatedata' को 'updateData' और 'sellerupdateschema' को 'sellerUpdateSchema' में बदला

  if (isNaN(sellerId)) { // 'isnan' को 'isNaN' में बदला
    return res.status(400).json({ error: 'Invalid seller ID.' }); // संदेश में सुधार
  }

  const [existingSeller] = await db.query.sellersPgTable.findMany({ where: eq(sellersPgTable.id, sellerId) }); // 'existingseller' को 'existingSeller' में बदला
  if (!existingSeller) {
    return res.status(404).json({ message: 'Seller not found.' });
  }

  const finalUpdateData: Partial<typeof sellersPgTable.$inferInsert> = { // 'partial' को 'Partial' में और '$inferinsert' को '$inferInsert' में बदला
    ...updateData,
    updatedAt: new Date(), // 'updatedat' को 'updatedAt' और 'new date()' को 'new Date()' में बदला
  };

  // undefined values को हटा दें ताकि वे डेटाबेस में null के रूप में सेट न हों
  Object.keys(finalUpdateData).forEach(key => { // 'object.keys' को 'Object.keys' और 'foreach' को 'forEach' में बदला
    if (finalUpdateData[key as keyof typeof finalUpdateData] === undefined) {
      delete finalUpdateData[key as keyof typeof finalUpdateData];
    }
  });

  const [updatedSeller] = await db.update(sellersPgTable) // 'updatedseller' को 'updatedSeller' में बदला
    .set(finalUpdateData)
    .where(eq(sellersPgTable.id, sellerId))
    .returning();

  if (!updatedSeller) {
    return res.status(500).json({ message: 'Failed to update seller.' });
  }

  return res.status(200).json({ message: "Seller profile updated successfully.", seller: updatedSeller });
});
