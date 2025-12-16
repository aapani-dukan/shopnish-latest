// backend/src/routes/addressRoutes.ts

import { Router, Request, Response, NextFunction } from 'express'; // NextFunction जोड़ा गया
import { db } from '../server/db'; 
import { deliveryAddresses } from '../shared/backend/schema'; 
import { eq, and } from 'drizzle-orm';
import { z } from 'zod'; 
// Auth middleware से AuthenticatedRequest/requireAuth/verifyToken आयात करें
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken'; 
import { requireAuth } from '../server/middleware/authMiddleware'; 
import axios from 'axios';
import { geocodeAddress, reverseGeocode, isWithinServiceArea, calculateDeliveryCharges } from '../services/locationService';


const addressRouter = Router();

// 🟢 FIX 1: Schemas में कोई बदलाव नहीं, लेकिन latitude/longitude types को स्पष्ट रखा गया है
const ProcessLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const CreateAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  pincode: z.string().min(6, 'Pincode is required').max(10),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().optional(),
  isDefault: z.boolean().default(false).optional(),
 // userId: z.number().optional(), 
});

const UpdateAddressSchema = CreateAddressSchema.partial().extend({
  // ID पैरामीटर से आएगा, इसलिए schema में इसकी आवश्यकता नहीं है
});


// FATAL DEBUG TEST LOG: यह सुनिश्चित करने के लिए कि यह रूट हिट हो रहा है
addressRouter.use('/process-current-location', (req, res, next) => {
    console.log(`\n\n[!!! FATAL DEBUG TEST !!!] Request received for: ${req.method} ${req.originalUrl}`);
    next();
});


// 1. POST /api/addresses/process-current-location
addressRouter.post(
  '/process-current-location',
  async (req: Request, res: Response) => {
    try {
      // 🛑 FIX 2: अनावश्यक लॉग हटाएं, यह validation के सफल होने पर ही चलेगा
      // console.log("[DEBUG] addressRoutes: Zod validation faild for process-current-location handler."); 
      
      const validation = ProcessLocationSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("[DEBUG] addressRoutes: Zod validation failed for process-current-location.", validation.error.issues);
        return res.status(400).json({ errors: validation.error.issues });
      }
      const { latitude, longitude } = validation.data;
      console.log(`[DEBUG] addressRoutes: Validated coords: Lat ${latitude}, Lng ${longitude}`); 

      const fullAddressDetails = await reverseGeocode(latitude, longitude);

      if (!fullAddressDetails) {
        console.warn("[DEBUG] addressRoutes: reverseGeocode returned no address details."); 
        return res.status(404).json({ message: 'Could not resolve address from coordinates.' });
      }
      console.log(`[DEBUG] addressRoutes: Address resolved: ${fullAddressDetails.formattedAddress}`); 


      const inServiceArea = await isWithinServiceArea(fullAddressDetails.pincode);
      // यदि service area में नहीं है, तो charges null होंगे, जैसा कि नीचे है।
      const deliveryCharges = inServiceArea ? await calculateDeliveryCharges(fullAddressDetails.pincode) : null;

      console.log(`[DEBUG] addressRoutes: Service area: ${inServiceArea}, Delivery Charges: ${deliveryCharges}`); 

      return res.status(200).json({
        latitude,
        longitude,
        address: fullAddressDetails.formattedAddress,
        addressLine1: fullAddressDetails.addressLine1,
        city: fullAddressDetails.city,
        state: fullAddressDetails.state,
        pincode: fullAddressDetails.pincode,
        inServiceArea,
        deliveryCharges,
      });
    } catch (error) {
      console.error('Error in addressRoutes.ts process-current-location handler:', error); 
      if (axios.isAxiosError(error) && error.response) {
        console.error("Axios Error Response Status:", error.response.status);
        console.error("Axios Error Response Data:", error.response.data);
      }
      // NextFunction को कॉल करें ताकि ग्लोबल एरर हैंडलर इसे संभाल सके
      // next(error); 
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);


// Require authentication for all subsequent address routes
addressRouter.use(requireAuth); 


// 2. GET /api/addresses/user
addressRouter.get(
  '/user',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 🛑 FIX 3: Drizzle ID का उपयोग करें (firebaseUid नहीं) और उसे Number में बदलें
      const userId = req.user?.id; 
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const userAddresses = await db.select()
        .from(deliveryAddresses)
        .where(eq(deliveryAddresses.userId, Number(userId))); // Number में बदलने की आवश्यकता हो सकती है

      return res.status(200).json(userAddresses);
    } catch (error) {
      console.error('Error fetching user addresses:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);






// 3. POST /api/addresses
addressRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 1. User ID चेक: सुनिश्चित करें कि यह मौजूद है
      const userId = req.user?.id; 
      if (!userId) {
        // यदि टोकन मौजूद है लेकिन req.user.id नहीं है, तो यह Auth Middleware की समस्या है
        console.error("Auth Middleware Error: User ID is missing after token verification.");
        return res.status(401).json({ message: 'Unauthorized: User ID missing.' });
      }

      // 🛑 FIX: Number() का उपयोग करके सुनिश्चित करें कि यह संख्या है
      const userIdNum = Number(userId);
       // 🚨 चेक 1: क्या Auth Middleware सही ID दे रहा है?
      console.log(`[AUTH-DEBUG-1] Received User ID: ${userId} (Type: ${typeof userId})`);

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: User ID missing.' });
      }
      
      // 🚨 चेक 2: क्या यह वास्तव में एक संख्या है?
      const userIdNum = Number(userId);
      if (isNaN(userIdNum)) {
         // यदि req.user.id एक Firebase UID स्ट्रिंग है, तो यह NaN देगा
         console.error("Auth Middleware Error: req.user.id is not a valid number. Value:", userId);
         // यदि आपका users टेबल Firebase UID का उपयोग करता है, तो आपको यह तर्क बदलना होगा
         return res.status(401).json({ message: 'Unauthorized: User ID type mismatch.' });
      }
      
      // ... (Zod validation, pincode/latitude/longitude extraction) ...
      
      const [newAddress] = await db.insert(deliveryAddresses)
        .values({
          ...addressDetails,
          postalCode: pincode, 
          // 🛑 FIX: latitude/longitude को String में रखना सुरक्षित है
          latitude: String(latitude), 
          longitude: String(longitude),
          // 🛑 FIX: userIdNum का उपयोग करें (जो अब Number है)
          userId: userIdNum, 
        })
        .returning();

      return res.status(201).json(newAddress);
    } catch (error) {
      // ⚠️ यह क्रैश अब NOT NULL constraint या FOREIGN KEY constraint के कारण होना चाहिए।
      console.error('FINAL CRASH LOG: Error creating address:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);


// 4. PUT /api/addresses/:id
addressRouter.put(
  '/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 🛑 FIX 6: Drizzle ID का उपयोग करें
      const userId = req.user?.id; 
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const userIdNum = Number(userId);
      const addressId = Number(req.params.id);

      // Zod validation
      const validation = UpdateAddressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.issues });
      }
      const updateData = validation.data;
        if (!state || state.length === 0) {
          // स्कीमा कहती है कि state notNull है, लेकिन यदि यह undefined/खाली स्ट्रिंग है, तो यह क्रैश होगा।
          console.error(`[FATAL-DEBUG-3] State is missing or empty. Value: ${state}`);
          return res.status(500).json({ message: 'Internal server error: State field is mandatory.' });
        }
       if (!addressDetails.city || addressDetails.city.length === 0) {
          console.error(`[FATAL-DEBUG-4] City is missing or empty. Value: ${addressDetails.city}`);
          return res.status(500).json({ message: 'Internal server error: City field is mandatory.' });
       }

      // 🛑 FIX 7: existingAddress query को पूरा करें और इसे update से पहले चलाएं
      const existingAddresses = await db.select()
        .from(deliveryAddresses)
        .where(
          and(
            eq(deliveryAddresses.id, addressId),
            eq(deliveryAddresses.userId, userIdNum)
          )
        );

      if (existingAddresses.length === 0) {
        return res.status(404).json({ message: 'Address not found or unauthorized' });
      }

     // अगर update default है, तो पहले सारे default हटाएं
     if (updateData.isDefault) {
        await db.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userIdNum));
      }

      const [updatedAddress] = await db.update(deliveryAddresses)
        .set({
          fullName: updateData.fullName,
          addressLine1: updateData.addressLine1,
          addressLine2: updateData.addressLine2,
          city: updateData.city,
          state: updateData.state,
          // 🛑 FIX 8: स्कीमा से मेल खाने के लिए pincode को postalCode में बदलें (या स्कीमा बदलें)
          postalCode: updateData.pincode, 
          latitude: updateData.latitude,
          longitude: updateData.longitude,
          label: updateData.label,
          // isDefault को undefined से बचाने के लिए || false का उपयोग करें
          isDefault: updateData.isDefault || false,
          updatedAt: new Date(),
        })
        .where(and(
          eq(deliveryAddresses.id, addressId),
          eq(deliveryAddresses.userId, userIdNum)
        ))
        .returning();

      if (!updatedAddress) {
        // यदि updateData में कोई फ़ील्ड नहीं है, तो यह undefined हो सकता है
        // लेकिन अगर कोई रिकॉर्ड नहीं मिला, तो 404 पहले ही हैंडल हो गया है।
        return res.status(500).json({ message: 'Failed to update address' });
      }

      return res.status(200).json(updatedAddress);
    } catch (error) {
      console.error('Error updating address:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

// 5. DELETE /api/addresses/:id
addressRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 🛑 FIX 9: Drizzle ID का उपयोग करें
      const userId = req.user?.id; 
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const userIdNum = Number(userId);
      const addressId = Number(req.params.id);

      const [deletedAddress] = await db.delete(deliveryAddresses)
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userIdNum)))
        .returning();

      if (!deletedAddress) {
        return res.status(404).json({ message: 'Address not found or unauthorized' });
      }

      return res.status(200).json({ message: 'Address deleted successfully' });
    } catch (error) {
      console.error('Error deleting address:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

export default addressRouter;

