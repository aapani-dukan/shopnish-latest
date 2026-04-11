import { Response, NextFunction } from "express";
import { verifyToken, AuthenticatedRequest } from "./verifyToken";
import { deliveryBoys, sellersPgTable } from "../../shared/backend/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { authAdmin } from "../lib/firebaseAdmin";

/**
 * 1️⃣ Standard Authentication
 * Isme verifyToken (Jo ab Mobile/UID based hai) use hota hai.
 * Ye un routes ke liye hai jahan user pehle se login/register hai.
 */
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

/**
 * 2️⃣ Only Admin Access
 */
export const requireAdminAuth = [
  ...requireAuth,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "User not found." });

    if (!req.user.isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Admin access required.",
      });
    }
    next();
  },
];

/**
 * 3️⃣ Only Seller Access
 */
export const requireSellerAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Not authorized." });

    if (!req.user.isSeller) {
      return res.status(403).json({
        message: "Forbidden: Seller access required.",
      });
    }

    const userId = req.user.id;
    
    const sellerProfile = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, userId),
    });

    if (!sellerProfile || sellerProfile.approvalStatus !== "approved") {
         return res.status(403).json({ 
             message: "Seller account not approved or not found." 
         });
    }
    
    req.user.sellerId = sellerProfile.id; 
    next();
  },
];

/**
 * 4️⃣ Only Delivery Boy Access
 */
export const requireDeliveryBoyAuth = [
  ...requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Not authorized." });

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

/**
 * 5️⃣ Special Registration Middleware (Bypass Database Check)
 * Iska use sirf /register routes par hoga. 
 * Ye database mein user nahi dhundta, sirf Firebase Token verify karke 
 * UID aur Phone data req.firebaseUser mein bhej deta hai.
 */
export const verifyFirebaseOnly = async (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "No token provided." });
    }

    // Token verify karke Firebase User data nikaalein
    const decodedToken = await authAdmin.verifyIdToken(token);
    
    // Naya property set karein taaki controller ko pata chale ki user naya hai
    req.firebaseUser = decodedToken; 
    next();
  } catch (error) {
    console.error("❌ Firebase Verify Error:", error);
    res.status(401).json({ message: "Invalid or expired token." });
  }
};