import "express";

declare global {
  namespace Express {
    // 1. पहले User का ढांचा पक्का करें
    interface User {
      id: string;
      email?: string;
      role?: string;
      sellerId?: number | null;
      deliveryBoyId?: number | null;
    }

    // 2. अब Request के अंदर उसी User को इस्तेमाल करें
    interface Request {
      user?: User;
    }
  }
}

export {};