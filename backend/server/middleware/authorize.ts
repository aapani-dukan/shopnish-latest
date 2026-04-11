import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest, verifyToken } from "./verifyToken"; 

/**
 * ✅ 1. PROTECT Middleware
 * Ab ye khud DB query nahi karega, balki verifyToken ka use karega.
 * Isse duplicate queries khatam ho jayengi.
 */
export const protect: RequestHandler = async (req: any, res: Response, next: NextFunction) => {
  // Agar verifyToken pehle hi chal chuka hai aur user mil gaya hai
  if ((req as AuthenticatedRequest).user) {
    return next();
  }

  // Agar nahi chala, toh verifyToken ko call karo
  return verifyToken(req as any, res, next);
};

/**
 * ✅ 2. AUTHORIZE Middleware
 * Ye sirf ye check karega ki banda 'admin', 'seller' ya 'delivery-boy' hai ya nahi.
 */
export const authorize = (allowedRoles: string[]): RequestHandler => {
  return async (req: any, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    // 1. Pehle ensure karein ki user authenticated hai
    if (!authReq.user) {
      return res.status(401).json({ message: "Authentication required. Please login with Phone." });
    }

    const user = authReq.user;

    // 2. Role Check Logic (Mobile-First Flags based)
    // Hum sirf 'role' string par nahi, balki boolean flags par bhi trust karenge
    const hasAccess = 
      allowedRoles.includes(user.role) || 
      (allowedRoles.includes('admin') && user.isAdmin) ||
      (allowedRoles.includes('seller') && user.isSeller) ||
      (allowedRoles.includes('delivery-boy') && user.isDelivery);

    if (!hasAccess) {
      console.warn(`🚫 Access Denied for UID: ${user.firebaseUid}, Role: ${user.role}`);
      return res.status(403).json({ 
        message: `Forbidden: Access denied for ${user.role}.` 
      });
    }

    next();
  };
};