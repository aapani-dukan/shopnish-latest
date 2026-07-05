import "express";
  
declare global {
  namespace Express {
    // User structure ko actual backend requirements se match karein
    interface User {
      id: number | string;
      firebaseUid: string; // 👈 Ye sabse zaroori hai, iske bina req.user.firebaseUid error dega
      email?: string;
      role?: string;
      sellerId?: number | null;
      deliveryBoyId?: number | null;
    }

    interface Request {
      user?: User; // Request ke andar user ko optional rakhein taaki non-login routes na tutein
    }
  }
}

export {};