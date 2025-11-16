// server/middleware/authorize.ts

import { AuthenticatedRequest } from "./verifyToken"; // verifyToken से AuthenticatedRequest इम्पोर्ट करें
import { userRoleEnum } from "../../shared/backend/schema"; // तुम्हारे userRoleEnum को इम्पोर्ट करें

import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../lib/firebaseAdmin.ts"; // Firebase Admin SDK इम्पोर्ट करें
import { db } from "../db.ts"; // Drizzle DB इम्पोर्ट करें
import { users, UserRoleEnum } from "../../shared/backend/schema.ts"; // अपने UserRoleEnum और users स्कीमा को इम्पोर्ट करें
import { AuthenticatedUser } from "../../shared/types/user.ts"; // AuthenticatedUser को इम्पोर्ट करें
import { eq } from "drizzle-orm";

// AuthenticatedRequest इंटरफ़ेस को फिर से परिभाषित करें ताकि यह req.user को सही ढंग से टाइप कर सके
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser & {
    // AuthenticatedUser में sellerId और deliveryBoyId हैं या नहीं, इसके आधार पर यहां जोड़ें
    sellerId?: number;
    deliveryBoyId?: number;
  };
}

// ----------------------------------------------------
// protect मिडलवेयर
// @desc    Verify Firebase ID token and attach user from DB to request
// @access  Public (लेकिन टोकन की आवश्यकता है)
// ----------------------------------------------------
export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decodedToken = await authAdmin.verifyIdToken(token); // Firebase Admin SDK का उपयोग करें

      // DB से user info fetch करें
      const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));

      if (!dbUser) {
        console.error("❌ [protect] User not found in database for UID:", decodedToken.uid);
        return res.status(404).json({ message: 'User not found in database' });
      }

      // Base user attach करें
      req.user = {
        id: dbUser.id,
        firebaseUid: decodedToken.uid,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        approvalStatus: dbUser.approvalStatus,
        sellerId: undefined, // default
        deliveryBoyId: undefined, // default
      };

      // यदि आवश्यक हो तो SellerId और DeliveryBoyId को यहां पॉपुलेट करें
      // ध्यान दें: यदि आपके पास authMiddleware.ts में requireSellerAuth/requireDeliveryBoyAuth जैसे विशिष्ट मिडलवेयर हैं,
      // तो वे req.user में sellerId/deliveryBoyId को असाइन करने के लिए बेहतर जगह हो सकते हैं।
      // यदि आप इसे यहां करना चाहते हैं, तो आपको यहां seller/deliveryBoy टेबल को क्वेरी करना होगा।

      next();
    } catch (error: any) {
      console.error('❌ [protect] Error verifying token:', error.message);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } else {
    console.error('❌ [protect] No valid token provided');
    return res.status(401).json({ message: 'No valid token provided' });
  }
};


// ----------------------------------------------------
// authorize मिडलवेयर
// ----------------------------------------------------
/**
 * डायनामिक ऑथराइजेशन मिडलवेयर।
 * यह निर्दिष्ट भूमिकाओं (roles) में से किसी एक की अनुमति देता है।
 * `protect` मिडलवेयर के बाद उपयोग किया जाना चाहिए।
 *
 * @param allowedRoles भूमिकाओं का एक एरे (जैसे [UserRoleEnum.ENUM_VALUES.SELLER, UserRoleEnum.ENUM_VALUES.ADMIN])
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Forbidden: User role not defined or user not authenticated." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: User role '${req.user.role}' is not allowed to access this resource.`,
      });
    }

    next();
  };
};

/**
 * डायनामिक ऑथराइजेशन मिडलवेयर।
 * यह निर्दिष्ट भूमिकाओं (roles) में से किसी एक की अनुमति देता है।
 * `verifyToken` मिडलवेयर के बाद उपयोग किया जाना चाहिए (या `requireAuth` का एक हिस्सा)।
 *
 * @param allowedRoles भूमिकाओं का एक एरे (जैसे [userRoleEnum.enumValues[0], userRoleEnum.enumValues[2]])
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Forbidden: User role not defined or user not authenticated." });
    }

    // सुनिश्चित करें कि userRoleEnum के enumValues स्ट्रिंग array हैं
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: User role '${req.user.role}' is not allowed to access this resource.`,
      });
    }

    next();
  };
};
