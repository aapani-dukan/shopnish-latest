// shared/types/user.ts
import { z } from "zod";
import { userRoleEnum, approvalStatusEnum } from '../backend/schema.ts';

// सामान्य User interface
export interface User {
  // Firebase UID
  firebaseUid: string;

  // Firebase ID Token
  idToken: string;

  // ✅ Badlav: Email ab optional hai, aur Phone Number add kiya hai
  email?: string | null;       // Phone login wale users ka email starting mein nahi hoga
  phoneNumber?: string | null;  // OTP login ke liye
  
  name?: string | null;

  role: z.infer<typeof userRoleEnum>;

  // Optional: Seller-specific details
  seller?: {
    approvalStatus: z.infer<typeof approvalStatusEnum>;
  } | null;
}

// AuthenticatedUser interface
export interface AuthenticatedUser {
  id: number;                     // DB user ID
  firebaseUid: string;            // Firebase UID
  
  // ✅ Badlav: Yahan bhi email aur phone ko optional/nullable rakhein
  email?: string | null;
  phoneNumber?: string | null;
  
  name?: string | null;
  role: z.infer<typeof userRoleEnum>;
  approvalStatus: z.infer<typeof approvalStatusEnum>;
  deliveryBoyId?: number;         
}
