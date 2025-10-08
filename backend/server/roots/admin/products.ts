import { Router, Response } from 'express';
import { db } from '../../db.ts';
import { products, approvalStatusEnum } from '../../../shared/backend/schema.ts';
import { AuthenticatedRequest } from '../../middleware/verifyToken.ts';
import { eq } from 'drizzle-orm';
import { requireAdminAuth } from '../../middleware/authMiddleware.ts';

const router = Router();

// ✅ GET /api/admin/products/pending
// सभी लंबित (pending) प्रोडक्ट्स को फ़ेच करें
router.get('/pending', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingProducts = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[0]),
    });
    res.status(200).json(pendingProducts);
  } catch (error: any) {
    console.error('Failed to fetch pending products:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ GET /api/admin/products/approved
// सभी स्वीकृत (approved) प्रोडक्ट्स को फ़ेच करें
router.get('/approved', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvedProducts = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[1]),
    });
    res.status(200).json(approvedProducts);
  } catch (error: any) {
    console.error('Failed to fetch approved products:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ PATCH /api/admin/products/approve/:id
// एक प्रोडक्ट को मंज़ूर करें
router.patch('/approve/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid ID provided.' });
    }

    const [approved] = await db
      .update(products)
      .set({ approvalStatus: approvalStatusEnum.enumValues[1] })
      .where(eq(products.id, productId))
      .returning();

    if (!approved) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json({
      message: 'Product approved successfully.',
      product: approved,
    });
  } catch (error: any) {
    console.error('Failed to approve product:', error);
    res.status(500).json({ message: 'Failed to approve product.' });
  }
});

// ✅ PATCH /api/admin/products/reject/:id
// एक प्रोडक्ट को अस्वीकार करें
router.patch('/reject/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid ID provided.' });
    }

    const [rejected] = await db
      .update(products)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2] })
      .where(eq(products.id, productId))
      .returning();

    if (!rejected) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json({
      message: 'Product rejected successfully.',
      product: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject product:', error);
    res.status(500).json({ message: 'Failed to reject product.' });
  }
});

export default router;
