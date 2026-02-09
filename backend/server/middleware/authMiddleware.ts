// server/middleware/authMiddleware.ts
import { Response, NextFunction } from "express";
import { verifyToken, AuthenticatedRequest } from "./verifyToken";
import { deliveryBoys, sellersPgTable } from "../../shared/backend/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

// 1️⃣ सामान्य प्रमाणीकरण (No Change needed here)
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
] as any[];

// 2️⃣ केवल Admin के लिए (Updated for Boolean Logic)
export const requireAdminAuth = [
  ...requireAuth,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "User not found." });

    // ✅ नया तरीका: सीधा isAdmin चेक करें
    if (!req.user.isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }
    next();
  },
];

// 3️⃣ केवल Seller के लिए (Updated for Multi-Role)
export const requireSellerAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Not authorized." });

    // ✅ नया तरीका: isSeller चेक करें
    if (!req.user.isSeller) {
      return res.status(403).json({
        message: "Forbidden: Seller access required.",
      });
    }

    const userId = req.user.id;
    
    // DB से प्रोफाइल और अप्रूवल चेक करें
    const sellerProfile = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, userId),
    });

    // ✅ अब status सीधा "approved" स्ट्रिंग से चेक करें (ज्यादा सुरक्षित)
    if (!sellerProfile || sellerProfile.approvalStatus !== "approved") {
         return res.status(403).json({ 
             message: "Seller account not approved or not found." 
         });
    }
    
    req.user.sellerId = sellerProfile.id; 
    next();
  },
];

// 4️⃣ केवल Delivery Boy के लिए (Updated)
export const requireDeliveryBoyAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Not authorized." });

    // ✅ नया तरीका: isDelivery चेक करें
    if (!req.user.isDelivery) {
      return res.status(403).json({ message: "Forbidden: Not a delivery boy." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: and(
        eq(deliveryBoys.userId, req.user.id),
        eq(deliveryBoys.approvalStatus, "approved")
      ),
    });

    if (!deliveryBoy) {
      return res.status(403).json({
        message: "Forbidden: Delivery boy profile not approved.",
      });
    }

    req.user.deliveryBoyId = deliveryBoy.id;
    next();
  },
];