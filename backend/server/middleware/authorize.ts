// backend/server/middleware/authorize.ts

import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "./verifyToken"; 
import { authAdmin } from "../lib/firebaseAdmin";
import { db } from "../db";
import { users } from "../../shared/backend/schema";
import { eq } from "drizzle-orm";

// ✅ PROTECT Middleware (Ye ab AUTO-SYNC kar raha hai)
// ✅ PROTECT ko hatane ki zaroorat hai agar aap verifyToken use kar rahe ho, 
// lekin agar aap ise rakhna chahte ho toh isme bhi AUTO-SYNC logic daalna padega.

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Agar verifyToken.ts pehle chal chuka hai, toh req.user pehle se hoga.
  if (req.user) return next();

  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decodedToken = await authAdmin.verifyIdToken(token);

      // 🌟 OTP LOGIC: DB se user dhoondo ya naya banao (Same as verifyToken)
      let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));

      if (!dbUser) {
        // Auto-Register user if not found (High-class flow)
        [dbUser] = await db.insert(users).values({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || null,
          phone: decodedToken.phone_number || null, // Firebase se phone number
          role: "customer",
          approvalStatus: "approved",
        }).returning();
      }

      req.user = {
        id: dbUser.id,
        firebaseUid: decodedToken.uid,
        email: dbUser.email || null,
        name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName}` : "Customer",
        role: dbUser.role as any,
        approvalStatus: dbUser.approvalStatus as any,
      };

      next();
    } catch (error: any) {
      console.error('❌ [protect] Error:', error.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};

// ✅ AUTHORIZE Middleware (Ye ekdum sahi hai, isme sirf roles check honge)
export const authorize = (allowedRoles: string[]): RequestHandler => {
  return (req: any, res: Response, next: NextFunction) => {
    // req ko AuthenticatedRequest ki tarah treat karein
    const authReq = req as AuthenticatedRequest;
    const userRole = authReq.user?.role as string | undefined;

    if (!authReq.user || !userRole) {
      return res.status(403).json({ message: "Forbidden: No user or role found" });
    }

    // Role check logic
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: `Forbidden: Access denied for ${userRole}`,
      });
    }

    next();
  };
};
