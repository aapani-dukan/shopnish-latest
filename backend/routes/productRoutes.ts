// backend/routes/productRoutes.ts
import { Router } from 'express';
import { verifyToken } from '../server/middleware/verifyToken';
import { requireSellerAuth, requireAdminAuth } from '../server/middleware/authMiddleware';
import { upload } from '../server/middleware/multerConfig';
import * as ProductController from '../server/controllers/productController';
import { bulkCreateProducts } from "..//server/controllers/productController";
const router = Router();
router.get('/master-search', ProductController.searchMasterProducts);

// --- 📦 BULK UPLOAD (New) ---
// जो आपने शुरू में पूछा था, उसे यहाँ रजिस्टर कर रहे हैं
router.post('/bulk-products', verifyToken as any, requireAdminAuth, ProductController.bulkUploadProducts);
// Customer Endpoints
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

// Seller Endpoints
router.post('/', verifyToken as any, requireSellerAuth, upload.single('image'), ProductController.createProduct as any);
router.put('/:productId', verifyToken as any, requireSellerAuth, upload.single('image'), ProductController.updateProduct as any);
router.delete('/:productId', verifyToken as any, requireSellerAuth, ProductController.deleteProduct as any);
router.get('/seller', verifyToken as any, requireSellerAuth, ProductController.getSellerProducts as any);
router.post("/bulk", verifyToken as any, bulkCreateProducts);
// Admin Endpoints
router.get('/admin/pending', verifyToken as any, requireAdminAuth, ProductController.getPendingProducts);
router.put('/admin/:productId/approve', verifyToken as any, requireAdminAuth, ProductController.approveProduct);
router.put('/admin/:productId/reject', verifyToken as any, requireAdminAuth, ProductController.rejectProduct);

export default router;