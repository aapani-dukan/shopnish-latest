// server/middleware/authorize.ts

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./verifyToken"; // verifyToken से AuthenticatedRequest इम्पोर्ट करें
import { userRoleEnum } from "../../shared/backend/schema"; // तुम्हारे userRoleEnum को इम्पोर्ट करें

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
