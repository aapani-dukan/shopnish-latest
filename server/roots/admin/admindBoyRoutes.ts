import { Router, Response } from 'express';
import { db } from '../../db.ts';
import { deliveryBoys, users, approvalStatusEnum, userRoleEnum } from '../../../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../../middleware/verifyToken.ts';
import { requireAdminAuth } from '../../middleware/authMiddleware.ts';

const router = Router();

// ✅ GET /api/admin/delivery-boys/pending
// सभी लंबित (pending) डिलीवरी बॉय एप्लिकेशन को फ़ेच करें
router.get('/pending', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingApplications = await db.query.deliveryBoys.findMany({
      where: eq(deliveryBoys.approvalStatus, approvalStatusEnum.enumValues[0]),
    });
    res.status(200).json(pendingApplications);
  } catch (error: any) {
    console.error('Failed to fetch pending delivery boys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ GET /api/admin/delivery-boys/approved
// सभी स्वीकृत (approved) डिलीवरी बॉय को फ़ेच करें
router.get('/approved', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvedDeliveryBoys = await db.query.deliveryBoys.findMany({
      where: eq(deliveryBoys.approvalStatus, approvalStatusEnum.enumValues[1]),
    });
    res.status(200).json(approvedDeliveryBoys);
  } catch (error: any) {
    console.error('Failed to fetch approved delivery boys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ PATCH /api/admin/delivery-boys/approve/:id
// एक डिलीवरी बॉय को मंज़ूर करें
router.patch('/approve/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = Number(req.params.id);
    if (isNaN(deliveryBoyId)) {
      return res.status(400).json({ message: 'Invalid ID provided.' });
    }

    const [deliveryBoy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.id, deliveryBoyId));
    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found.' });
    }

    // डिलीवरी बॉय की स्थिति को 'approved' पर अपडेट करें
    const [approved] = await db
      .update(deliveryBoys)
      .set({ approvalStatus: 'approved' })
      .where(eq(deliveryBoys.id, deliveryBoyId))
      .returning();

    // ✅ संबंधित यूज़र की भूमिका (role) और अप्रूवल स्टेटस दोनों को अपडेट करें
    await db.update(users)
      .set({ role: 'delivery_boy', approvalStatus: 'approved' })
      .where(eq(users.id, deliveryBoy.userId));

    res.status(200).json({
      message: 'Delivery boy approved successfully.',
      deliveryBoy: approved,
    });
  } catch (error: any) {
    console.error('Failed to approve delivery boy:', error);
    res.status(500).json({ message: 'Failed to approve delivery boy.' });
  }
});

// ✅ PATCH /api/admin/delivery-boys/reject/:id
// एक डिलीवरी बॉय को अस्वीकार करें
router.patch('/reject/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = Number(req.params.id);
    if (isNaN(deliveryBoyId)) {
      return res.status(400).json({ message: 'Invalid ID provided.' });
    }

    const [rejected] = await db
      .update(deliveryBoys)
      .set({ approvalStatus: 'rejected' })
      .where(eq(deliveryBoys.id, deliveryBoyId))
      .returning();

    if (!rejected) {
      return res.status(404).json({ message: 'Delivery boy not found.' });
    }

    const [deliveryBoy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.id, deliveryBoyId));
    if (deliveryBoy) {
      // ✅ संबंधित यूज़र का अप्रूवल स्टेटस 'rejected' और भूमिका 'customer' पर अपडेट करें
      await db.update(users)
        .set({ approvalStatus: 'rejected', role: 'customer' })
        .where(eq(users.id, deliveryBoy.userId));
    }

    res.status(200).json({
      message: 'Delivery boy rejected successfully.',
      deliveryBoy: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject delivery boy:', error);
    res.status(500).json({ message: 'Failed to reject delivery boy.' });
  }
});

export default router;
