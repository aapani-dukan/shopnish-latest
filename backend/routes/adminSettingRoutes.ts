import { Router } from 'express';
import { db } from '../server/db';
import { adminSettings, promoCodes } from '../shared/backend/schema'; 
import { authorize } from '../server/middleware/authorize';
import { eq } from 'drizzle-orm';

const adminSettingsRouter = Router();

// --- Delivery Settings ---
adminSettingsRouter.get('/settings', authorize(['admin']), async (req, res) => {
  try {
    const result = await db.select().from(adminSettings).limit(1);
    let settings = result[0];
    // अगर टेबल खाली है तो पहली बार के लिए डिफ़ॉल्ट डेटा बनाएँ
    if (!settings) {
      const [newSettings] = await db.insert(adminSettings).values({}).returning();
      settings = newSettings;
    }
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: "Settings fetch fail" });
  }
});

adminSettingsRouter.put('/settings', authorize(['admin']), async (req, res) => {
  try {
    const [updated] = await db.update(adminSettings)
      .set({ ...req.body, updatedAt: new Date() })
      .returning();
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// --- Promocodes ---
adminSettingsRouter.get('/promocodes', authorize(['admin']), async (req, res) => {
  try {
    const codes = await db.select().from(promoCodes);
    return res.json(codes);
  } catch (err) {
    return res.status(500).json({ error: "Promocodes fetch fail" });
  }
});

export default adminSettingsRouter;