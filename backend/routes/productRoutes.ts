import { Router } from 'express';
import { verifyToken } from '../server/middleware/verifyToken';
import { requireSellerAuth, requireAdminAuth } from '../server/middleware/authMiddleware';
import { upload } from '../server/middleware/multerConfig';
import * as ProductController from '../server/controllers/productController';
import { bulkCreateProducts } from "..//server/controllers/productController";

const router = Router();

// --- 1. Static Search & Master Routes ---
router.get('/master-search', ProductController.searchMasterProducts);

// --- 2. Seller Endpoints (Specific ones MUST come before /:id) ---
// ✅ अब '/seller' आईडी वाले राउट से ऊपर है, तो 400 Error नहीं आएगा
router.get('/seller', verifyToken as any, requireSellerAuth, ProductController.getSellerProducts as any);
router.post("/bulk", verifyToken as any, requireSellerAuth, bulkCreateProducts);
router.post('/', verifyToken as any, requireSellerAuth, upload.single('image'), ProductController.createProduct as any);

// --- 3. Admin Endpoints ---
router.get('/admin/pending', verifyToken as any, requireAdminAuth, ProductController.getPendingProducts);
router.post('/bulk-products', verifyToken as any, requireAdminAuth, ProductController.bulkUploadProducts);
router.put('/admin/:productId/approve', verifyToken as any, requireAdminAuth, ProductController.approveProduct);
router.put('/admin/:productId/reject', verifyToken as any, requireAdminAuth, ProductController.rejectProduct);

// --- 4. Customer & General Endpoints ---
router.get('/', ProductController.getAllProducts);

// --- 5. Dynamic ID Routes (हमेशा सबसे नीचे) ---
// अब यह सिर्फ तभी चलेगा जब ऊपर का कोई रूट मैच नहीं होगा
router.get('/:id', ProductController.getProductById);

// --- 6. Update/Delete Endpoints ---
router.put('/:productId', verifyToken as any, requireSellerAuth, upload.single('image'), ProductController.updateProduct as any);
router.delete('/:productId', verifyToken as any, requireSellerAuth, ProductController.deleteProduct as any);

export default router;