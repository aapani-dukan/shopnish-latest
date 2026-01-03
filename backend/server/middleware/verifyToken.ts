// server/middleware/verifyToken.ts
import { Request, Response, NextFunction } from 'express';
import { authAdmin } from '../lib/firebaseAdmin.ts';
import { db } from '../db.ts';
import { users, deliveryBoys } from '../../shared/backend/schema.ts'; 
import { eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../shared/types/user.ts';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser & { deliveryBoyId?: number }; 
}

export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  console.log("🔍 [verifyToken] Incoming Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ [verifyToken] No valid token provided');
    return res.status(401).json({ message: 'No valid token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    // 1. DB mein user dhoondo
    let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));

    // 🌟 HIGH-CLASS LOGIC: Agar user DB mein nahi hai, toh naya banao (Auto-Sync)
    if (!dbUser) {
      console.log("🆕 [verifyToken] User not found, creating new entry for UID:", decodedToken.uid);
      
      const [newUser] = await db.insert(users).values({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || null,
        phone: decodedToken.phone_number || null,
        firstName: "New", // Baad mein profile update mein change kar sakte hain
        lastName: "User",
        role: "customer", // Default role
        approvalStatus: "approved",
      }).returning();
      
      dbUser = newUser;
    }

    // 2. Base user attach karein (Email ya Phone jo bhi available ho)
    req.user = {
      id: dbUser.id,
      firebaseUid: decodedToken.uid,
      email: dbUser.email || decodedToken.email || null,
      phoneNumber: dbUser.phone || decodedToken.phone_number || null,
      name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName}` : "User",
      role: dbUser.role as any,
      approvalStatus: dbUser.approvalStatus as any,
    };
    console.log("✅ [verifyToken] Base User Attached:", req.user);

    // ✅ सिर्फ delivery-boy के लिए deliveryBoyId attach करें
    if (dbUser.role === 'delivery-boy') {
      const [dbDeliveryBoy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, dbUser.id));
      console.log("🔍 [verifyToken] DeliveryBoy Record:", dbDeliveryBoy);

      if (!dbDeliveryBoy) {
        console.error("❌ [verifyToken] Delivery boy record not found for userId:", dbUser.id);
        return res.status(404).json({ message: 'Delivery boy record not found' });
      }

      req.user.deliveryBoyId = dbDeliveryBoy.id;
      console.log("✅ [verifyToken] DeliveryBoyId attached:", dbDeliveryBoy.id);
      console.log("✅ [verifyToken] Final Delivery-Boy User Object:", req.user);
    }

    next();
  } catch (error: any) {
    console.error('❌ [verifyToken] Error verifying token:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
