import { Router } from 'express';
import { db } from '../server/db';
import { adminSettings, promoCodes } from '../shared/backend/schema'; 
import { authorize } from '../server/middleware/authorize';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../server/middleware/verifyToken';

const adminSettingsRouter = Router();

// --- 🚚 Delivery Settings Fetch ---
adminSettingsRouter.get('/settings', verifyToken as any, authorize(['admin']), async (req, res) => {
  try {
    const result = await db.select().from(adminSettings).limit(1);
    let settings = result[0];

    if (!settings) {
      // ✅ Agar pehli baar hai, toh default values ke saath insert karein
      const [newSettings] = await db.insert(adminSettings).values({
        baseDeliveryCharge: 20,
        chargePerKm: 5,
        extraPickupCharge: 15, // Default bonus
        platformCommissionRate: 10,
        freeDeliveryMinOrderValue: 500
      }).returning();
      settings = newSettings;
    }
    return res.json(settings);
  } catch (err) {
    console.error("❌ Settings Fetch Error:", err);
    return res.status(500).json({ error: "Settings fetch fail" });
  }
});

// --- ⚙️ Update Settings ---
adminSettingsRouter.put('/settings', verifyToken as any, authorize(['admin']), async (req, res) => {
  try {
    // ✅ Safely extract values from body
    const { 
      baseDeliveryCharge, 
      chargePerKm, 
      extraPickupCharge, 
      platformCommissionRate, 
      freeDeliveryMinOrderValue,
      defaultDeliveryRadiusKm 
    } = req.body;

    const [updated] = await db.update(adminSettings)
      .set({ 
        baseDeliveryCharge,
        chargePerKm,
        extraPickupCharge,
        platformCommissionRate,
        freeDeliveryMinOrderValue,
        defaultDeliveryRadiusKm,
        updatedAt: new Date() 
      })
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error("❌ Update Settings Error:", err);
    return res.status(500).json({ error: "Update failed" });
  }
});

// --- 🎟️ Promocodes ---
adminSettingsRouter.get('/promocodes', verifyToken as any, authorize(['admin']), async (req, res) => {
  try {
    const codes = await db.select().from(promoCodes);
    return res.json(codes);
  } catch (err) {
    console.error("❌ Promocodes Fetch Error:", err);
    return res.status(500).json({ error: "Promocodes fetch fail" });
  }
});

export default adminSettingsRouter;