import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "./verifyToken"; 
import { authAdmin } from "../lib/firebaseAdmin";
import { db } from "../db";
import { users } from "../../shared/backend/schema";
import { eq } from "drizzle-orm";

// ✅ 1. PROTECT Middleware (इसे वापस एक्सपोर्ट कर रहे हैं ताकि बिल्ड फेल न हो)
export const protect = async (req: any, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user) return next();

  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decodedToken = await authAdmin.verifyIdToken(token);
      let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));

      if (!dbUser) {
        [dbUser] = await db.insert(users).values({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || null,
          phone: decodedToken.phone_number || null,
          role: "customer",
          approvalStatus: "approved",
        }).returning();
      }

       // ✅ यूजर का रोल और स्टेटस निकालें
      const userRole = dbUser.role || 'customer';

      authReq.user = {
        id: dbUser.id,
        firebaseUid: decodedToken.uid,
        email: dbUser.email || null,
        name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName || ''}`.trim() : "User",
        role: userRole as any,
        approvalStatus: dbUser.approvalStatus as any,
        
        // 🚀 TypeScript की डिमांड पूरी करने के लिए बूलियन फ्लैग्स जोड़ें
        isAdmin: userRole === 'admin' || !!dbUser.isAdmin,
        isSeller: userRole === 'seller' || !!dbUser.isSeller,
        isDelivery: (userRole as string) === 'delivery-boy' || !!dbUser.isDelivery,
        
        // 📦 IDs को सुरक्षित तरीके से सेट करें
        sellerId: (dbUser as any).sellerId || undefined,
        deliveryBoyId: (dbUser as any).deliveryBoyId || undefined,
      };

      next();
    } catch (error: any) {
      console.error("Auth Middleware Error:", error);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};
// ✅ 2. AUTHORIZE Middleware (Combined version)
export const authorize = (allowedRoles: string[]): RequestHandler => {
  return async (req: any, res: Response, next: NextFunction) => {
    // अगर protect पहले नहीं चला है, तो उसे यहीं चला दो
    if (!(req as AuthenticatedRequest).user) {
      await protect(req, res, () => {}); 
      // दोबारा चेक करें अगर protect ने user सेट कर दिया
      if (!(req as AuthenticatedRequest).user) return; 
    }

    const userRole = (req as AuthenticatedRequest).user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: `Forbidden: Access denied for ${userRole}` });
    }
    next();
  };
};