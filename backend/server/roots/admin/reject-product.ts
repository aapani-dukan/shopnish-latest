// server/roots/admin/reject-product.ts
import { Router, Response } from 'express';
import { db } from '../../db.ts'; // Correct relative path
import { products, approvalStatusEnum } from '../../../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../../middleware/verifyToken.ts'; // Corrected import path
import { requireAdminAuth } from '../../middleware/authMiddleware.ts'; // Corrected import path

const router = Router();

router.post('/admin/products/:productId/reject', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const productId = parseInt(req.params.productId);
  const { reason } = req.body;
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID.' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  try {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await db.update(products).set({
      approvalStatus: approvalStatusEnum.enumValues[2], // rejected
      rejectionReason: reason
    }).where(eq(products.id, productId));

    res.status(200).json({ message: 'Product rejected successfully.' });
  } catch (error: any) {
    console.error('Failed to reject product:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
