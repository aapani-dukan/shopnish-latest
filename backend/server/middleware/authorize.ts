import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "./verifyToken"; 
import { authAdmin } from "../lib/firebaseAdmin";
import { db } from "../db";
import { users } from "../../shared/backend/schema";
import { eq } from "drizzle-orm";

// ✅ The "Universal" Authorize: Ye khud token verify karega aur role bhi check karega
export const authorize = (allowedRoles: string[]): RequestHandler => {
  return async (req: any, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    // 1. Agar req.user pehle se nahi hai, toh token verify karke user nikalo
    if (!authReq.user) {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
          token = req.headers.authorization.split(' ')[1];
          const decodedToken = await authAdmin.verifyIdToken(token);

          // DB se user dhoondo ya auto-register karo
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

          // User ko request object mein attach karo
          authReq.user = {
            id: dbUser.id,
            firebaseUid: decodedToken.uid,
            email: dbUser.email || null,
            name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName}` : "Customer",
            role: dbUser.role as any,
            approvalStatus: dbUser.approvalStatus as any,
          };
        } catch (error: any) {
          console.error('❌ [Authorize-Verify] Error:', error.message);
          return res.status(401).json({ message: 'Invalid or expired token' });
        }
      } else {
        return res.status(401).json({ message: 'No authorization token found' });
      }
    }

    // 2. Ab User ki identity mil chuki hai, Role check karo
    const userRole = authReq.user?.role as string | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: `Forbidden: Access denied for ${userRole || 'Unknown Role'}`,
      });
    }

    // Sab sahi hai, aage badho
    next();
  };
};