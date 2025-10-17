// backend/src/routes/addresses.ts

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { drizzle } from '../db'; // Your Drizzle DB instance
import { deliveryAddresses } from '../shared/backend/schema';
import { eq, and } from 'drizzle-orm';

// Services/Utils
import { geocodeAddress, reverseGeocode, isWithinServiceArea, calculateDeliveryCharges } from '../services/locationService'; // We'll create this

// Middleware (assuming you have authMiddleware)
import { authMiddleware } from '../server/middlewares/authMiddleware'; // For user authentication

const addresses = new Hono();

// --- Schemas for Validation ---

// For processing current location (latitude, longitude)
const ProcessLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// For saving a new address
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
  label: z.string().optional(), // e.g., 'Home', 'Work'
  isDefault: z.boolean().default(false).optional(),
});

// For updating an existing address
const UpdateAddressSchema = CreateAddressSchema.partial().extend({
  id: z.number(), // ID is required for updating
});

// --- API Endpoints ---

// 1. POST /api/addresses/process-current-location
//    Geocodes Lat/Lng, checks service area, calculates delivery charges.
addresses.post(
  '/process-current-location',
  zValidator('json', ProcessLocationSchema),
  async (c) => {
    try {
      const { latitude, longitude } = c.req.valid('json');

      const fullAddressDetails = await reverseGeocode(latitude, longitude);

      if (!fullAddressDetails) {
        return c.json({ message: 'Could not resolve address from coordinates.' }, 404);
      }

      const inServiceArea = await isWithinServiceArea(fullAddressDetails.pincode);
      const deliveryCharges = inServiceArea ? await calculateDeliveryCharges(fullAddressDetails.pincode) : null;

      return c.json({
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
      return c.json({ message: 'Internal server error.' }, 500);
    }
  }
);

// Protect subsequent routes with authentication
addresses.use('*', authMiddleware);

// 2. GET /api/addresses/user
//    Fetch all saved addresses for the authenticated user.
addresses.get(
  '/user',
  async (c) => {
    try {
      const userId = c.get('userId'); // Extracted from authMiddleware
      if (!userId) return c.json({ message: 'Unauthorized' }, 401);

      const userAddresses = await drizzle.select()
        .from(deliveryAddresses)
        .where(eq(deliveryAddresses.userId, userId))
        .orderBy(deliveryAddresses.isDefault ? 'desc' : 'asc', deliveryAddresses.createdAt); // Default first, then by creation date

      return c.json(userAddresses);
    } catch (error) {
      console.error('Error fetching user addresses:', error);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  }
);

// 3. POST /api/addresses
//    Save a new address for the authenticated user.
addresses.post(
  '/',
  zValidator('json', CreateAddressSchema),
  async (c) => {
    try {
      const userId = c.get('userId');
      if (!userId) return c.json({ message: 'Unauthorized' }, 401);

      const newAddressData = c.req.valid('json');

      // If this new address is set as default, unset other defaults for this user
      if (newAddressData.isDefault) {
        await drizzle.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userId));
      }

      const [newAddress] = await drizzle.insert(deliveryAddresses)
        .values({
          ...newAddressData,
          userId,
        })
        .returning();

      return c.json(newAddress, 201);
    } catch (error) {
      console.error('Error creating address:', error);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  }
);

// 4. PUT /api/addresses/:id
//    Update an existing address for the authenticated user.
addresses.put(
  '/:id',
  zValidator('json', UpdateAddressSchema),
  async (c) => {
    try {
      const userId = c.get('userId');
      if (!userId) return c.json({ message: 'Unauthorized' }, 401);

      const addressId = Number(c.req.param('id'));
      const updateData = c.req.valid('json');

      // Ensure the address belongs to the user
      const existingAddress = await drizzle.select()
        .from(deliveryAddresses)
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)));

      if (existingAddress.length === 0) {
        return c.json({ message: 'Address not found or unauthorized' }, 404);
      }

      // If setting this address as default, unset others
      if (updateData.isDefault === true) {
        await drizzle.update(deliveryAddresses)
          .set({ isDefault: false })
          .where(eq(deliveryAddresses.userId, userId));
      }

      const [updatedAddress] = await drizzle.update(deliveryAddresses)
        .set({
          ...updateData,
          updatedAt: new Date(), // Update timestamp
        })
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)))
        .returning();

      if (!updatedAddress) {
        return c.json({ message: 'Failed to update address' }, 500);
      }

      return c.json(updatedAddress);
    } catch (error) {
      console.error('Error updating address:', error);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  }
);

// 5. DELETE /api/addresses/:id
//    Delete an address for the authenticated user.
addresses.delete(
  '/:id',
  async (c) => {
    try {
      const userId = c.get('userId');
      if (!userId) return c.json({ message: 'Unauthorized' }, 401);

      const addressId = Number(c.req.param('id'));

      // Ensure the address belongs to the user and then delete
      const [deletedAddress] = await drizzle.delete(deliveryAddresses)
        .where(and(eq(deliveryAddresses.id, addressId), eq(deliveryAddresses.userId, userId)))
        .returning();

      if (!deletedAddress) {
        return c.json({ message: 'Address not found or unauthorized' }, 404);
      }

      return c.json({ message: 'Address deleted successfully' });
    } catch (error) {
      console.error('Error deleting address:', error);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  }
);

export default addresses;
