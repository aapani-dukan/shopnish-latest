import { Request, Response, NextFunction, RequestHandler } from 'express';
import { authAdmin } from '../lib/firebaseAdmin';
import { db } from '../db';
import { users, deliveryBoys } from '../../shared/backend/schema'; 
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    sellerId?: number | null;
    firebaseUid: string;
    phoneNumber: string;
    name: string | null;
    role: string;
    isAdmin: boolean;
    isSeller: boolean;
    isDelivery: boolean;
    approvalStatus: string;
    deliveryBoyId?: number | null;
  };
}
export const verifyToken = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No valid token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    // 1. Database mein user dhundo
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));

    // 2. 🚩 SMART LOGIC: Agar user nahi hai, toh Error mat do! 
    // Bas Firebase ka data req.user mein dalo taaki /users/me use register kar sake.
    if (!dbUser) {
      req.user = {
        firebaseUid: firebaseUid,
        phoneNumber: decodedToken.phone_number || "",
        email: decodedToken.email || "",
        name: decodedToken.name || "User",
        isNewUser: true // Ek flag taaki backend ko pata chale register karna hai
      };
      return next(); // ✅ Agle step (/users/me) par jane do
    }

    // 3. Agar user mil gaya, toh normal mapping
    req.user = {
      id: dbUser.id,
      firebaseUid: dbUser.firebaseUid,
      phoneNumber: dbUser.phone || "",
      name: `${dbUser.firstName || "User"} ${dbUser.lastName || ""}`.trim(),
      role: dbUser.role as string,
      isAdmin: !!dbUser.isAdmin, 
      isSeller: !!dbUser.isSeller,
      isDelivery: !!dbUser.isDelivery,
      approvalStatus: dbUser.approvalStatus as string,
    };

    // Delivery Boy extra ID linkage
    if (dbUser.isDelivery) {
      const [dboy] = await db.select({ id: deliveryBoys.id }).from(deliveryBoys).where(eq(deliveryBoys.userId, dbUser.id));
      if (dboy) req.user.deliveryBoyId = dboy.id;
    }

    next();
  } catch (error: any) {
    console.error('❌ Auth Error:', error.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};