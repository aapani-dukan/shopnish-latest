// backend/src/routes/addressRoutes.ts

import { Router, Request, Response, NextFunction } from 'express'; // NextFunction जोड़ा गया
import { db } from '../server/db'; 
import { deliveryAddresses, users } from '../shared/backend/schema'; 
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
      // 1. Firebase UID प्राप्त करें
      const firebaseUid = req.user?.uid || req.user?.id; // Firebase UID स्ट्रिंग
      if (!firebaseUid) return res.status(401).json({ message: 'Unauthorized' });

      // 🛑 FIX: Drizzle Users टेबल से Postgres User ID (संख्या) प्राप्त करें
      const userResult = await db.select({ id: users.id }) // users स्कीमा को इम्पोर्ट करना याद रखें
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid)) 
        .limit(1);

      const userIdNum = req.user?.id; 

          if (!userIdNum || typeof userIdNum !== 'number') {
        // यदि Firebase UID स्ट्रिंग के बजाय Drizzle ID संख्या नहीं है, तो 401 दें
        console.error("GET Address: Missing or Invalid Numeric User ID in req.user.");
        return res.status(401).json({ message: 'Unauthorized: Invalid User ID format.' });
          }

      const userAddresses = await db.select()
        .from(deliveryAddresses)
        .where(eq(deliveryAddresses.userId, userIdNum)); // ✅ सही संख्यात्मक ID का उपयोग करें

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
      // 1. Firebase UID प्राप्त करें
      const firebaseUid = req.user?.firebaseUid;
         if (!firebaseUid || typeof firebaseUid !== 'string') {
        console.error("Auth Error: req.user does not contain a valid Firebase UID string.");
        // यदि 18 आ रहा है, तो आपका middleware गलत property का उपयोग कर रहा है।
        return res.status(401).json({ message: 'Authentication Failed: Invalid UID type.' });
         }
      

      // 🛑 FIX 1: Firebase UID का उपयोग करके Postgres (Drizzle) User ID (संख्या) प्राप्त करें
      const userResult = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid)) // ⚠️ सुनिश्चित करें कि users टेबल में 'firebaseUid' कॉलम है (string)
        .limit(1);

      const userIdNum = userResult[0]?.id; // यह अब Postgres Integer ID है

      if (!userIdNum) {
          // यदि उपयोगकर्ता हमारे DB में नहीं है (केवल Firebase में है)
          console.error(`User not found in DB for UID: ${firebaseUid}`);
          return res.status(404).json({ message: 'User profile not found in database.' });
      }
      
      // ... (Zod validation, pincode, lat/lng extraction) ...
      const validation = CreateAddressSchema.safeParse(req.body);
      if (!validation.success) {
        // यदि डेटा अमान्य है, तो 400 त्रुटि दें
        return res.status(400).json({ errors: validation.error.issues });
      }
      const { pincode, latitude, longitude, ...addressDetails } = validation.data; 

      // 🛑 FIX 2: isDefault लॉजिक को वापस लाएँ (यह अब क्रैश नहीं होगा क्योंकि userIdNum एक संख्या है)
      if (addressDetails.isDefault) {
        await db.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userIdNum));
      }

      // 🛑 FIX 3: Drizzle Insert
      const [newAddress] = await db.insert(deliveryAddresses)
        .values({
          ...addressDetails,
          postalCode: pincode, 
          userId: userIdNum, // ✅ यह अब संख्या (integer) है!
          latitude: String(latitude), 
          longitude: String(longitude),
        })
        .returning();

      return res.status(201).json(newAddress);
    } catch (error) {
      console.error('Error creating address (Final):', error);
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

