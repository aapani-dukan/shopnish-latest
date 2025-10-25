// backend/src/routes/addressRoutes.ts

import { Router, Request, Response } from 'express';
import { db } from '../server/db'; // Your Drizzle DB instance
import { deliveryAddresses } from '../shared/backend/schema'; // यह मानकर चल रहे हैं कि यह पाथ सही है
import { eq, and } from 'drizzle-orm';
import { z } from 'zod'; // Validation के लिए Zod
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken'; // Auth middleware
import { requireAuth } from '../server/middleware/authMiddleware'; // Auth middleware
import axios from 'axios';
// Services/Utils - ये तुम्हारे locationService.ts से आते हैं
import { geocodeAddress, reverseGeocode, isWithinServiceArea, calculateDeliveryCharges } from '../services/locationService';

const addressRouter = Router(); // Express Router इंस्टेंस
const schema = z.object({
  fullName: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});


// --- Schemas for Validation ---
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
});

const UpdateAddressSchema = CreateAddressSchema.partial().extend({
  id: z.number().optional(), // ID parameter से आएगा
});


// FATAL DEBUG TEST LOG: यह सुनिश्चित करने के लिए कि यह रूट हिट हो रहा है
addressRouter.use('/process-current-location', (req, res, next) => {
    console.log(`\n\n[!!! FATAL DEBUG TEST !!!] Request received for: ${req.method} ${req.originalUrl}`);
    next();
});


// 1. POST /api/addresses/process-current-location
//    Geocodes Lat/Lng, checks service area, calculates delivery charges.
addressRouter.post(
  '/process-current-location',
  async (req: Request, res: Response) => {
    try {
      console.log("[DEBUG] addressRoutes: Zod validation faild for  process-current-location handler."); // नया लॉग
      // Zod validation
      const validation = ProcessLocationSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("[DEBUG] addressRoutes: Zod validation failed for process-current-location.", validation.error.issues); // नया लॉग
        return res.status(400).json({ errors: validation.error.issues });
      }
      const { latitude, longitude } = validation.data;
      console.log(`[DEBUG] addressRoutes: Validated coords: Lat ${latitude}, Lng ${longitude}`); // नया लॉग

      // *** यहां असली Google API कॉल reverseGeocode फंक्शन में हो रही है ***
      // सुनिश्चित करें कि reverseGeocode फंक्शन के अंदर भी console.log हैं।
      const fullAddressDetails = await reverseGeocode(latitude, longitude);

      if (!fullAddressDetails) {
        console.warn("[DEBUG] addressRoutes: reverseGeocode returned no address details."); // नया लॉग
        return res.status(404).json({ message: 'Could not resolve address from coordinates.' });
      }
      console.log(`[DEBUG] addressRoutes: Address resolved: ${fullAddressDetails.formattedAddress}`); // नया लॉग


      const inServiceArea = await isWithinServiceArea(fullAddressDetails.pincode);
      const deliveryCharges = inServiceArea ? await calculateDeliveryCharges(fullAddressDetails.pincode) : null;

      console.log(`[DEBUG] addressRoutes: Service area: ${inServiceArea}, Delivery Charges: ${deliveryCharges}`); // नया लॉग

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
      console.error('Error in addressRoutes.ts process-current-location handler:', error); // अधिक विशिष्ट त्रुटि लॉग
      // यदि यह AxiosError है, तो उसके विवरण को भी लॉग करें
      if (axios.isAxiosError(error) && error.response) {
        console.error("Axios Error Response Status:", error.response.status);
        console.error("Axios Error Response Data:", error.response.data);
      }
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);


// Require authentication for all subsequent address routes
addressRouter.use(requireAuth); // इस लाइन के बाद के सभी राउट्स को प्रमाणीकरण की आवश्यकता होगी

// 2. GET /api/addresses/user
//    Fetch all saved addresses for the authenticated user.
addressRouter.get(
  '/user',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.firebaseUid; // From requireAuth middleware
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const userAddresses = await db.select()
        .from(deliveryAddresses)
        .where(eq(deliveryAddresses.userId, Number(userId)))
  

      return res.status(200).json(userAddresses);
    } catch (error) {
      console.error('Error fetching user addresses:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

// 3. POST /api/addresses
//    Save a new address for the authenticated user.
addressRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.firebaseUid;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Zod validation
      const validation = CreateAddressSchema.safeParse(req.body);
      if (!validation.success) {
        // validation.error.issues is the correct property
        return res.status(400).json({ errors: validation.error.issues });
      }

      const newAddressData = validation.data;

      // अगर नया address default है तो पहले सारे default हटाएं
      if (newAddressData.isDefault) {
        await db.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, Number(req.user?.id || "0")));
      }

      const [newAddress] = await db.insert(deliveryAddresses)
        .values({
          ...newAddressData,
          userId,
        })
        .returning();

      return res.status(201).json(newAddress);
    } catch (error) {
      console.error('Error creating address:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

// 4. PUT /api/addresses/:id
//    Update an existing address for the authenticated user.
addressRouter.put(
  '/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.firebaseUid;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const addressId = Number(req.params.id);

      // Zod validation
      const validation = UpdateAddressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.issues });
      }
      const updateData = validation.data;


      const existingAddress = await db.select()
        .from(deliveryAddresses)
        const userIdNum = Number(userId); // userId string है तो number में बदलें

await db
  .update(deliveryAddresses)
  .set({ isDefault: false })
  .where(
    and(
      eq(deliveryAddresses.id, addressId),
      eq(deliveryAddresses.userId, userIdNum) // number type
    )
  );

      if (existingAddress.length === 0) {
        return res.status(404).json({ message: 'Address not found or unauthorized' });
      }

     if (updateData.isDefault) {
  await db.update(deliveryAddresses)
    .set({ isDefault: false })
    .where(eq(deliveryAddresses.userId, Number(userId)));
}

      const [updatedAddress] = await db.update(deliveryAddresses)
  .set({
    fullName: updateData.fullName,
    addressLine1: updateData.addressLine1,
    addressLine2: updateData.addressLine2,
    city: updateData.city,
    state: updateData.state,
    postalCode: updateData.pincode,
    latitude: updateData.latitude,
    longitude: updateData.longitude,
    label: updateData.label,
    isDefault: updateData.isDefault,
    updatedAt: new Date(),
  })
  .where(and(
    eq(deliveryAddresses.id, addressId),
    eq(deliveryAddresses.userId, Number(userId))
  ))
  .returning();

      if (!updatedAddress) {
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
//    Delete an address for the authenticated user.
addressRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.firebaseUid;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const addressId = Number(req.params.id);

      const [deletedAddress] = await db.delete(deliveryAddresses)
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, Number(req.user?.id))))
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
