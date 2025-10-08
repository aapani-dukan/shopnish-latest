// shared/types/user.ts
import { z } from "zod";
import { userRoleEnum, approvalStatusEnum } from '../backend/schema.ts';

// सामान्य User interface
export interface User {
  // Firebase UID
  firebaseUid: string;

  // Firebase ID Token
  idToken: string;

  // सामान्य विवरण
  email: string;
  name?: string | null;

  role: z.infer<typeof userRoleEnum>;

  // Optional: Seller-specific details
  seller?: {
    approvalStatus: z.infer<typeof approvalStatusEnum>;
  } | null;
}

// AuthenticatedUser interface (delivery boy support सहित)
export interface AuthenticatedUser {
  id: number;                     // DB user ID
  firebaseUid: string;            // Firebase UID
  email: string;
  name?: string | null;
  role: z.infer<typeof userRoleEnum>;
  approvalStatus: z.infer<typeof approvalStatusEnum>;
  deliveryBoyId?: number;         // ✅ सिर्फ delivery boy के लिए
}
