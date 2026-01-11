import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../server/middleware/verifyToken';
import { requireAdminAuth } from '../server/middleware/authMiddleware';
import { upload } from '../server/middleware/multerConfig';
import * as LayoutController from '../server/controllers/layoutController';

const router = Router();

// ✅ Public Route: Koi bhi customer app khole toh banners dikhein
router.get('/public', LayoutController.getHomeLayout);

// ✅ Admin Route: Sirf aap layout badal sakein
router.post(
  '/admin/add', 
  verifyToken as any,      
  requireAdminAuth as any, 
  upload.single('image'), 
  LayoutController.addHomeElement as any
);

export default router;
