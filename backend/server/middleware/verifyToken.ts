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

export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No valid token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    // ✅ Seedha UID se user dhundo (Kyunki DB clear hai aur login sirf Phone se hai)
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));

    if (!dbUser) {
      return res.status(404).json({ 
        message: 'User not found. Please register.',
        needsSync: false 
      });
    }

    // ✅ req.user data mapping
    req.user = {
      id: dbUser.id,
      firebaseUid: dbUser.firebaseUid || firebaseUid, // Fallback to decoded UID
      phoneNumber: dbUser.phone || "",
      name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName || ""}`.trim() : "User",
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