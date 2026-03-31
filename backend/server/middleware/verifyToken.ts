// server/middleware/verifyToken.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { authAdmin } from '../lib/firebaseAdmin';
import { db } from '../db';
import { users, deliveryBoys } from '../../shared/backend/schema'; 
import { eq } from 'drizzle-orm';

// ✅ 1. Interface को अपडेट किया (सारे एरर्स यहीं से खत्म होंगे)
export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    firebaseUid: string;
    email?: string | null;
    phoneNumber?: string | null;
    name?: string | null;
    role: string;               // Compatibility के लिए
    isAdmin: boolean;           // ✅ नया
    isSeller: boolean;          // ✅ नया
    isDelivery: boolean;        // ✅ नया
    approvalStatus?: string;
    sellerId?: number | null;
    deliveryBoyId?: number | null;
  };
}

export const catchAuth = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => any): RequestHandler => {
  return fn as unknown as RequestHandler;
};

export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No valid token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    // DB से यूजर निकालें
    let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));

    if (!dbUser) {
      console.log(`⚠️ User ${decodedToken.email} not found in DB. Needs Sync.`);
      return res.status(404).json({ 
        message: 'User not found in database. Please complete registration.',
        needsSync: true 
      });
    }
    // ✅ 2. req.user में नए कॉलम्स मैप करें
    req.user = {
      id: dbUser.id,
      firebaseUid: dbUser.firebaseUid || decodedToken.uid,
      email: dbUser.email || decodedToken.email || null,
      phoneNumber: dbUser.phone || decodedToken.phone_number || null,
      name: dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName}` : "User",
      role: dbUser.role as string,
      
      // 🔥 ये तीन लाइनें सबसे ज़रूरी हैं:
      isAdmin: !!dbUser.isAdmin, 
      isSeller: !!dbUser.isSeller,
      isDelivery: !!dbUser.isDelivery,
      
      approvalStatus: dbUser.approvalStatus as string,
    };

    // delivery-boy के लिए ID attach करें (पुराना लॉजिक)
    if (dbUser.isDelivery || dbUser.role === 'delivery-boy') {
      const [dbDeliveryBoy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, dbUser.id));
      if (dbDeliveryBoy) {
        req.user.deliveryBoyId = dbDeliveryBoy.id;
      }
    }

    next();
  } catch (error: any) {
    console.error('❌ [verifyToken] Error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};