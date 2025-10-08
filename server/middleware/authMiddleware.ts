// server/middleware/authMiddleware.ts
import { Response, NextFunction } from "express";
import { verifyToken, AuthenticatedRequest } from "./verifyToken";
import { userRoleEnum, deliveryBoys, sellersPgTable, approvalStatusEnum } from "../../shared/backend/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

// सामान्य प्रमाणीकरण
export const requireAuth = [
  verifyToken,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized: Authentication required.",
      });
    }
    next();
  },
];

// केवल Admin के लिए
export const requireAdminAuth = [
  ...requireAuth,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user.role !== userRoleEnum.enumValues[2]) {
      // ✅ admin
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }
    next();
  },
];

// केवल Seller के लिए
export const requireSellerAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // ✅ async जोड़ें
    if (req.user.role !== userRoleEnum.enumValues[1]) {
      // ✅ seller
      return res.status(403).json({
        message: "Forbidden: Seller access required.",
      });
    }

    const userId = req.user.id;
    
    // 1. Postgres User ID का उपयोग करके Seller ID और Approval Status खोजें।
    const sellerProfile = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, userId),
    });

    // 2. Seller मौजूद है और स्वीकृत है इसकी जाँच करें
    // मान लें कि 'approved' आपके approvalStatusEnum का दूसरा (index 1) या कोई अन्य मान है।
    const approvedStatus = approvalStatusEnum.enumValues[1]; // उदाहरण के लिए 'approved'
    
    if (!sellerProfile || sellerProfile.approvalStatus !== approvedStatus) {
         return res.status(403).json({ 
             message: "Seller authentication failed. Profile not found or not approved." 
         });
    }
    
    // 3. ✅ sellerId को req.user में जोड़ें
    req.user.sellerId = sellerProfile.id; 
    
    next();
  },
];


// केवल Delivery Boy के लिए

// ✅ केवल Delivery Boy के लिए (सुधारित)
export const requireDeliveryBoyAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log("🔍 [requireDeliveryBoyAuth] User:", req.user);

    if (!req.user || req.user.role !== userRoleEnum.enumValues[3]) {
      // ✅ delivery-boy
      return res.status(403).json({ message: "Forbidden: Not a delivery boy." });
    }

    // ❌ यह लाइन गलत थी: req.user.sellerId = sellerProfile.id;
    // इसे हटा दें, यह Delivery Boy middleware में नहीं होना चाहिए

    // DB से deliveryBoy record fetch करें
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: and(
        eq(deliveryBoys.userId, req.user.id),
        eq(deliveryBoys.approvalStatus, "approved")
      ),
    });

    if (!deliveryBoy) {
      return res.status(403).json({
        message: "Forbidden: Delivery boy not approved or not found.",
      });
    }

    // req.user में deliveryBoyId attach करें
    req.user.deliveryBoyId = deliveryBoy.id;

    next();
  },
];
