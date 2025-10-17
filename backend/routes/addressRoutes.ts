// backend/src/routes/addressRoutes.ts

import { Router, Request, Response } from 'express';
import { db } from '../server/db'; // Your Drizzle DB instance
import { deliveryAddresses } from '../shared/backend/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod'; // Validation के लिए Zod
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken'; // Auth middleware
import { requireAuth } from '../server/middleware/authMiddleware'; // Auth middleware

// Services/Utils
import { geocodeAddress, reverseGeocode, isWithinServiceArea, calculateDeliveryCharges } from '../services/locationService';

const addressRouter = Router(); // Express Router इंस्टेंस

// --- Schemas for Validation ---
// Zod स्कीमा को Express validator (जैसे express-validator या कस्टम मिडलवेयर) के साथ इस्तेमाल किया जा सकता है
// अभी के लिए, हम इसे मैन्युअल रूप से संभालेंगे।

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


// 1. POST /api/addresses/process-current-location
//    Geocodes Lat/Lng, checks service area, calculates delivery charges.
addressRouter.post(
  '/process-current-location',
  async (req: Request, res: Response) => {
    try {
      // Zod validation
      const validation = ProcessLocationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }
      const { latitude, longitude } = validation.data;

      const fullAddressDetails = await reverseGeocode(latitude, longitude);

      if (!fullAddressDetails) {
        return res.status(404).json({ message: 'Could not resolve address from coordinates.' });
      }

      const inServiceArea = await isWithinServiceArea(fullAddressDetails.pincode);
      const deliveryCharges = inServiceArea ? await calculateDeliveryCharges(fullAddressDetails.pincode) : null;

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
      console.error('Error processing location:', error);
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
        .where(eq(deliveryAddresses.userId, userId))
        .orderBy(deliveryAddresses.isDefault ? 'desc' : 'asc', deliveryAddresses.createdAt);

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
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      // Zod validation
      const validation = CreateAddressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }
      const newAddressData = validation.data;

      if (newAddressData.isDefault) {
        await db.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userId));
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
        return res.status(400).json({ errors: validation.error.errors });
      }
      const updateData = validation.data;


      const existingAddress = await db.select()
        .from(deliveryAddresses)
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)));

      if (existingAddress.length === 0) {
        return res.status(404).json({ message: 'Address not found or unauthorized' });
      }

      if (updateData.isDefault === true) {
        await db.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userId));
      }

      const [updatedAddress] = await db.update(deliveryAddresses)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)))
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
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)))
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
                          
