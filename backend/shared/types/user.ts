import { z } from "zod";
import { userRoleEnum, approvalStatusEnum } from '../backend/schema';

// ✅ Role और Status के Types को इन्फर करें
export type UserRole = z.infer<typeof userRoleEnum>;
export type ApprovalStatus = z.infer<typeof approvalStatusEnum>;

// सामान्य User interface (Frontend/Auth के लिए)
export interface User {
  firebaseUid: string;
  idToken: string;
  email?: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  role: UserRole;

  // Seller-specific details
  seller?: {
    approvalStatus: ApprovalStatus;
  } | null;
}

// ✅ AuthenticatedUser interface (Backend Middleware और Global State के लिए)
export interface AuthenticatedUser {
  id: number;                     // DB user ID
  firebaseUid: string;            // Firebase UID
  email?: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;

  // 🚀 Flags: ये बार-बार होने वाले Comparison एरर्स को खत्म कर देंगे
  isAdmin: boolean;
  isSeller: boolean;
  isDelivery: boolean;

  // 📦 ID References: जो बाद में वॉलेट और ऑर्डर मैनेजमेंट में काम आएंगे
  sellerId?: number | null;         
  deliveryBoyId?: number | null;         
}