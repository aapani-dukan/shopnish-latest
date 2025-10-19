// backend/src/routes/customerRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../server/db';
import { deliveryAddresses, users } from '../../shared/backend/schema'; // users भी इम्पोर्ट करें
import { AuthenticatedRequest, verifyToken } from '../../server/middleware/verifyToken';
import { eq, and, desc } from 'drizzle-orm';
import { geocodeAddress } from '../../services/geocodingService'; // Geocoding Service इम्पोर्ट करें

const customerRouter = Router();

// ✅ GET /api/customer/addresses (सभी डिलीवरी एड्रेस Fetch करें, डिफ़ॉल्ट पहले)
customerRouter.get('/addresses', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
        }

        const addresses = await db.select()
            .from(deliveryAddresses)
            .where(eq(deliveryAddresses.userId, userId))
            .orderBy(
                desc(deliveryAddresses.isDefault), // डिफ़ॉल्ट पते को उच्च प्राथमिकता दें
                desc(deliveryAddresses.createdAt) // फिर नए बनाए गए पते
            );
        
        return res.status(200).json(addresses);

    } catch (error: any) {
        console.error('❌ Error in GET /api/customer/addresses:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});


// ✅ POST /api/customer/addresses (नया डिलीवरी एड्रेस जोड़ें)
customerRouter.post('/addresses', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
    }

    const { fullName, phoneNumber, addressLine1, addressLine2, city, state, postalCode, label, isDefault } = req.body;

    if (!fullName || !addressLine1 || !city || !state || !postalCode) {
      return res.status(400).json({ error: 'Missing required address fields.' });
    }

    const fullAddress = `${addressLine1}, ${addressLine2 ? addressLine2 + ', ' : ''}${city}, ${state}, ${postalCode}`;
    const geocodeResult = await geocodeAddress(fullAddress);

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (geocodeResult) {
      latitude = geocodeResult.latitude;
      longitude = geocodeResult.longitude;
    } else {
      console.warn(`[customerRoutes] Could not geocode address: ${fullAddress}. Storing without lat/lng.`);
    }

    if (isDefault) {
      await db.update(deliveryAddresses)
        .set({ isDefault: false, updatedAt: new Date() }) // updatedAt भी अपडेट करें
        .where(eq(deliveryAddresses.userId, userId));
    }

    const [newAddress] = await db
      .insert(deliveryAddresses)
      .values({
        userId,
        fullName,
        phoneNumber: phoneNumber || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        state,
        postalCode,
        latitude,
        longitude,
        label: label || null,
        isDefault: isDefault || false,
      })
      .returning();

    res.status(201).json(newAddress);
  } catch (error: any) {
    console.error('❌ Error in POST /api/customer/addresses:', error);
    next(error);
  }
});

// ✅ PUT /api/customer/addresses/:id (मौजूदा डिलीवरी एड्रेस को अपडेट करें)
customerRouter.put('/addresses/:id', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const addressId = parseInt(req.params.id);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
    }
    if (isNaN(addressId)) {
      return res.status(400).json({ error: 'Invalid address ID.' });
    }

    const { fullName, phoneNumber, addressLine1, addressLine2, city, state, postalCode, label, isDefault } = req.body;

    if (!fullName && !phoneNumber && !addressLine1 && !addressLine2 && !city && !state && !postalCode && !label && isDefault === undefined) {
      return res.status(400).json({ message: "No update data provided." });
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let updatePayload: any = { updatedAt: new Date() };

    if (addressLine1 || addressLine2 || city || state || postalCode) {
      const [existingAddress] = await db.select().from(deliveryAddresses).where(and(
          eq(deliveryAddresses.id, addressId),
          eq(deliveryAddresses.userId, userId)
      ));

      if (!existingAddress) {
          return res.status(404).json({ error: 'Delivery address not found or not authorized.' });
      }

      const currentAddress = { ...existingAddress, ...req.body };
      const fullAddress = `${currentAddress.addressLine1}, ${currentAddress.addressLine2 ? currentAddress.addressLine2 + ', ' : ''}${currentAddress.city}, ${currentAddress.state}, ${currentAddress.postalCode}`;
      
      const geocodeResult = await geocodeAddress(fullAddress);
      if (geocodeResult) {
        latitude = geocodeResult.latitude;
        longitude = geocodeResult.longitude;
      } else {
        console.warn(`[customerRoutes] Could not geocode updated address: ${fullAddress}. Latitude/Longitude will not be updated.`);
      }
      
      updatePayload.latitude = latitude;
      updatePayload.longitude = longitude;
    }
    
    if (fullName !== undefined) updatePayload.fullName = fullName;
    if (phoneNumber !== undefined) updatePayload.phoneNumber = phoneNumber;
    if (addressLine1 !== undefined) updatePayload.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updatePayload.addressLine2 = addressLine2;
    if (city !== undefined) updatePayload.city = city;
    if (state !== undefined) updatePayload.state = state;
    if (postalCode !== undefined) updatePayload.postalCode = postalCode;
    if (label !== undefined) updatePayload.label = label;

    if (isDefault) {
      await db.update(deliveryAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(deliveryAddresses.userId, userId));
    }
    updatePayload.isDefault = isDefault !== undefined ? isDefault : false;

    const [updatedAddress] = await db
      .update(deliveryAddresses)
      .set(updatePayload)
      .where(and(
        eq(deliveryAddresses.id, addressId),
        eq(deliveryAddresses.userId, userId)
      ))
      .returning();

    if (!updatedAddress) {
      return res.status(404).json({ error: 'Delivery address not found or not authorized to update.' });
    }

    res.status(200).json(updatedAddress);
  } catch (error: any) {
    console.error('❌ Error in PUT /api/customer/addresses/:id:', error);
    next(error);
  }
});

// ✅ PATCH /api/customer/addresses/:id/set-default (किसी पते को डिफ़ॉल्ट के रूप में सेट करें)
customerRouter.patch('/addresses/:id/set-default', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const addressId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
    }
    if (isNaN(addressId)) {
      return res.status(400).json({ error: 'Invalid address ID.' });
    }

    const [existingAddress] = await db.select()
      .from(deliveryAddresses)
      .where(and(
        eq(deliveryAddresses.id, addressId),
        eq(deliveryAddresses.userId, userId)
      ));

    if (!existingAddress) {
      return res.status(404).json({ error: 'Delivery address not found or not authorized.' });
    }

    await db.update(deliveryAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(deliveryAddresses.userId, userId));

    const [updatedAddress] = await db.update(deliveryAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(deliveryAddresses.id, addressId))
      .returning();

    if (!updatedAddress) {
      return res.status(404).json({ error: 'Failed to set address as default.' });
    }

    return res.status(200).json({ message: 'Address set as default successfully.', address: updatedAddress });

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/customer/addresses/:id/set-default:', error);
    next(error);
  }
});

// ✅ DELETE /api/customer/addresses/:id (डिलीवरी एड्रेस हटाएं)
customerRouter.delete('/addresses/:id', verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const addressId = parseInt(req.params.id);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
        }
        if (isNaN(addressId)) {
            return res.status(400).json({ error: 'Invalid address ID.' });
        }

        const [deletedAddress] = await db.delete(deliveryAddresses)
            .where(and(
                eq(deliveryAddresses.id, addressId),
                eq(deliveryAddresses.userId, userId)
            ))
            .returning();

        if (!deletedAddress) {
            return res.status(404).json({ error: 'Delivery address not found or not authorized to delete.' });
        }

        // यदि हटाया गया पता डिफ़ॉल्ट था और अन्य पते मौजूद हैं,
        // तो किसी अन्य पते को नया डिफ़ॉल्ट सेट करने पर विचार करें।
        // (यह तर्क अभी के लिए छोड़ दिया गया है ताकि कोड सरल रहे।)

        return res.status(200).json({ message: 'Address deleted successfully.', address: deletedAddress });

    } catch (error: any) {
        console.error('❌ Error in DELETE /api/customer/addresses/:id:', error);
        next(error);
    }
});


export default customerRouter;
            
