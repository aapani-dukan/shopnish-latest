import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest';
import { db } from '../server/db';
import { deliveryAreas } from '../shared/backend/schema';
import { eq, like, and } from 'drizzle-orm';
import { verifyToken } from '../middleware/verifyToken'; // ऑथेंटिकेशन
import { authorize } from '../middleware/authorize'; // ऑथराइजेशन

const adminDeliveryAreasRouter = Router();

// Zod स्कीमा को परिभाषित करें ताकि आने वाले डेटा को मान्य किया जा सके
const createDeliveryAreaSchema = z.object({
  body: z.object({
    areaName: z.string().min(1, "Area name is required."),
    pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits."),
    city: z.string().min(1, "City is required."),
    state: z.string().min(1, "State is required."),
    deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be a valid decimal number.").optional().default('0.00'),
    freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/, "Free delivery amount must be a valid decimal number.").optional().default('0.00'),
    isActive: z.boolean().optional().default(true),
  }),
});

const updateDeliveryAreaSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number."),
  }),
  body: z.object({
    areaName: z.string().min(1, "Area name is required.").optional(),
    pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits.").optional(),
    city: z.string().min(1, "City is required.").optional(),
    state: z.string().min(1, "State is required.").optional(),
    deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be a valid decimal number.").optional(),
    freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/, "Free delivery amount must be a valid decimal number.").optional(),
    isActive: z.boolean().optional(),
  }),
});

// GET: सभी डिलीवरी एरिया प्राप्त करें (एडमिन के लिए)
adminDeliveryAreasRouter.get(
  '/',
  verifyToken,
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

// GET: ID द्वारा एकल डिलीवरी एरिया प्राप्त करें
adminDeliveryAreasRouter.get(
  '/:id',
  verifyToken,
  authorize(['admin']),
  validateRequest(z.object({ params: z.object({ id: z.string().regex(/^\d+$/, "ID must be a number.") }) })),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

// POST: नया डिलीवरी एरिया बनाएं
adminDeliveryAreasRouter.post(
  '/',
  verifyToken,
  authorize(['admin']),
  validateRequest(createDeliveryAreaSchema),
  async (req, res) => {
    try {
      const { areaName, pincode, city, state, deliveryCharge, freeDeliveryAbove, isActive } = req.body;

      const existingArea = await db.select().from(deliveryAreas).where(eq(deliveryAreas.pincode, pincode));
      if (existingArea.length > 0) {
        return res.status(409).json({ message: "Delivery area with this pincode already exists." });
      }

      const [newArea] = await db.insert(deliveryAreas).values({
        areaName,
        pincode,
        city,
        state,
        deliveryCharge,
        freeDeliveryAbove,
        isActive,
      }).returning(); // newly inserted row को वापस लौटाता है

      return res.status(201).json({ message: "Delivery area created successfully.", area: newArea });
    } catch (error) {
      console.error("[adminDeliveryAreasRoutes] Error creating delivery area:", error);
      return res.status(500).json({ message: "Failed to create delivery area." });
    }
  }
);

// PUT: मौजूदा डिलीवरी एरिया को अपडेट करें
adminDeliveryAreasRouter.put(
  '/:id',
  verifyToken,
  authorize(['admin']),
  validateRequest(updateDeliveryAreaSchema),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;

      const [updatedArea] = await db.update(deliveryAreas)
        .set({ ...updateData, updatedAt: new Date() }) // updatedAt को भी अपडेट करें
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

// DELETE: डिलीवरी एरिया को हटाएं
adminDeliveryAreasRouter.delete(
  '/:id',
  verifyToken,
  authorize(['admin']),
  validateRequest(z.object({ params: z.object({ id: z.string().regex(/^\d+$/, "ID must be a number.") }) })),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const [deletedArea] = await db.delete(deliveryAreas)
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
        
