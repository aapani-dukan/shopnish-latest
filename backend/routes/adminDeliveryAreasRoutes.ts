// backend/routes/adminDeliveryAreasRoutes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod'; // ✅ Zod अभी भी यहाँ उपयोग किया जाएगा
import { db } from '../server/db';
import { deliveryAreas } from '../shared/backend/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../server/middleware/verifyToken';
import { authorize } from '../server/middleware/authorize';
import { validateRequest } from '../server/middleware/validation'; // ✅ हाइब्रिड validateRequest
// express-validation-schema से अब कुछ भी आयात करने की आवश्यकता नहीं है यदि आप Zod का उपयोग कर रहे हैं।
// यदि आप अभी भी कुछ express-validator स्कीमा का उपयोग करते हैं, तो उन्हें यहाँ आयात करें।

const adminDeliveryAreasRouter = Router();

// ✅ Create schema (Zod) - अब 'body' के बजाय सीधा ऑब्जेक्ट जो 'body' को वैलिडेट करेगा
const createDeliveryAreaBodySchema = z.object({
  areaName: z.string().min(1, "Area name is required."),
  pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits."),
  city: z.string().min(1, "City is required."),
  deliveryCharge: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be a valid decimal number.")
    .optional()
    .default("0.00"),
  freeDeliveryAbove: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Free delivery amount must be a valid decimal number.")
    .optional()
    .default("0.00"),
  isActive: z.boolean().optional().default(true),
});

// ✅ GET /:id के लिए Zod स्कीमा
const getDeliveryAreaByIdZodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number.").transform(Number), // ✅ ID को नंबर में बदलें
  }),
});

// ✅ POST / के लिए Zod स्कीमा
const createDeliveryAreaZodSchema = z.object({
  body: createDeliveryAreaBodySchema, // ✅ सीधे बॉडी स्कीमा का उपयोग करें
});


// ✅ Update schema (Zod)
const updateDeliveryAreaZodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number.").transform(Number), // ✅ ID को नंबर में बदलें
  }),
  body: z.object({
    areaName: z.string().min(1, "Area name is required.").optional(),
    pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits.").optional(),
    city: z.string().min(1, "City is required.").optional(),
    deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be valid.").optional(),
    freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/, "Free delivery must be valid.").optional(),
    isActive: z.boolean().optional(),
  }),
});

// ✅ DELETE /:id के लिए Zod स्कीमा
const deleteDeliveryAreaZodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number.").transform(Number), // ✅ ID को नंबर में बदलें
  }),
});


// ✅ GET: All delivery areas
adminDeliveryAreasRouter.get(
  '/',
  verifyToken as any,
  authorize(['admin']),
  async (req, res) => {
    try {
      const areas = await db.select().from(deliveryAreas);
      return res.status(200).json(areas);
    } catch (error) {
      console.error("[adminDeliveryAreasRoutes] Error fetching delivery areas:", error);
      return res.status(500).json({ message: "Failed to fetch delivery areas." });
    }
  }
);

// ✅ GET: Single delivery area by ID
adminDeliveryAreasRouter.get(
  '/:id',
  verifyToken as any,
  authorize(['admin']),
  validateRequest(getDeliveryAreaByIdZodSchema), // ✅ Zod स्कीमा का उपयोग करें (Zod part of validateRequest will handle this)
  async (req, res) => {
    try {
      // Zod के transform() के कारण req.params.id अब एक संख्या होगी
      const id = req.params.id as any as number; // Type assertion since Zod transforms it
      const area = await db.select().from(deliveryAreas).where(eq(deliveryAreas.id, id));

      if (area.length === 0) {
        return res.status(404).json({ message: "Delivery area not found." });
      }

      return res.status(200).json(area[0]);
    } catch (error) {
      console.error(`[adminDeliveryAreasRoutes] Error fetching delivery area with ID ${req.params.id}:`, error);
      return res.status(500).json({ message: "Failed to fetch delivery area." });
    }
  }
);

// ✅ POST: Create new delivery area
adminDeliveryAreasRouter.post(
  '/',
  verifyToken as any,
  authorize(['admin']),
  validateRequest(createDeliveryAreaZodSchema), // ✅ Zod स्कीमा का उपयोग करें
  async (req, res) => {
    try {
      // req.body पहले ही Zod द्वारा वैलिडेट हो चुका होगा
      // Zod के default() के कारण deliveryCharge और freeDeliveryAbove अभी भी string होंगे, उन्हें number में बदलें
      const { areaName, pincode, city, deliveryCharge, freeDeliveryAbove, isActive } = req.body;

      const existingArea = await db.select().from(deliveryAreas).where(eq(deliveryAreas.pincode, pincode));
      if (existingArea.length > 0) {
        return res.status(409).json({ message: "Delivery area with this pincode already exists." });
      }

      const [newArea] = await db
        .insert(deliveryAreas)
        .values({
          areaName,
          pincode,
          city,
          deliveryCharge: parseFloat(deliveryCharge), // ✅ String से Number में बदलें
          freeDeliveryAbove: parseFloat(freeDeliveryAbove), // ✅ String से Number में बदलें
          isActive,
        }as any) // Type assertion to any to bypass type issues
        .returning();

      return res.status(201).json({ message: "Delivery area created successfully.", area: newArea });
    } catch (error) {
      console.error("[adminDeliveryAreasRoutes] Error creating delivery area:", error);
      return res.status(500).json({ message: "Failed to create delivery area." });
    }
  }
);

// ✅ PUT: Update delivery area
adminDeliveryAreasRouter.put(
  '/:id',
   verifyToken as any,
  authorize(['admin']),
  validateRequest(updateDeliveryAreaZodSchema), // ✅ Zod स्कीमा का उपयोग करें
  async (req, res) => {
    try {
      // req.params.id और req.body पहले ही Zod द्वारा वैलिडेट और ट्रांसफॉर्म हो चुके होंगे
      const id = req.params.id as any as number;
      let updateData = req.body;

      // सुनिश्चित करें कि numeric fields को number में पार्स किया गया है, यदि वे मौजूद हैं
      if (updateData.deliveryCharge !== undefined) updateData.deliveryCharge = parseFloat(updateData.deliveryCharge);
      if (updateData.freeDeliveryAbove !== undefined) updateData.freeDeliveryAbove = parseFloat(updateData.freeDeliveryAbove);

      const [updatedArea] = await db
        .update(deliveryAreas)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(deliveryAreas.id, id))
        .returning();

      if (!updatedArea) {
        return res.status(404).json({ message: "Delivery area not found." });
      }

      return res.status(200).json({ message: "Delivery area updated successfully.", area: updatedArea });
    } catch (error) {
      console.error(`[adminDeliveryAreasRoutes] Error updating delivery area with ID ${req.params.id}:`, error);
      return res.status(500).json({ message: "Failed to update delivery area." });
    }
  }
);

// ✅ DELETE: Remove delivery area
adminDeliveryAreasRouter.delete(
  '/:id',
  verifyToken as any,
  authorize(['admin']),
  validateRequest(deleteDeliveryAreaZodSchema), // ✅ Zod स्कीमा का उपयोग करें
  async (req, res) => {
    try {
      // req.params.id पहले ही Zod द्वारा वैलिडेट और ट्रांसफॉर्म हो चुका होगा
      const id = req.params.id as any as number;

      const [deletedArea] = await db
        .delete(deliveryAreas)
        .where(eq(deliveryAreas.id, id))
        .returning();

      if (!deletedArea) {
        return res.status(404).json({ message: "Delivery area not found." });
      }

      return res.status(200).json({ message: "Delivery area deleted successfully.", area: deletedArea });
    } catch (error) {
      console.error(`[adminDeliveryAreasRoutes] Error deleting delivery area with ID ${req.params.id}:`, error);
      return res.status(500).json({ message: "Failed to delete delivery area." });
    }
  }
);

export default adminDeliveryAreasRouter;
