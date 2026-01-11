// backend/routes/productRoutes.ts
import { Router } from 'express';
import { verifyToken } from '../server/middleware/verifyToken';
import { requireSellerAuth, requireAdminAuth } from '../server/middleware/authMiddleware';
import { upload } from '../server/middleware/multerConfig';
import * as ProductController from '../server/controllers/productController';

const router = Router();

// Customer Endpoints
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

// Seller Endpoints
router.post('/', verifyToken, requireSellerAuth, upload.single('image'), ProductController.createProduct);
router.put('/:productId', verifyToken, requireSellerAuth, upload.single('image'), ProductController.updateProduct);
router.delete('/:productId', verifyToken, requireSellerAuth, ProductController.deleteProduct);
router.get('/seller', verifyToken, requireSellerAuth, ProductController.getSellerProducts);

// Admin Endpoints
router.get('/admin/pending', verifyToken, requireAdminAuth, ProductController.getPendingProducts);
router.put('/admin/:productId/approve', verifyToken, requireAdminAuth, ProductController.approveProduct);
router.put('/admin/:productId/reject', verifyToken, requireAdminAuth, ProductController.rejectProduct);

export default router;