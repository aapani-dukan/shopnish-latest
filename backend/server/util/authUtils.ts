// server/util/authUtils.ts

import { authAdmin } from "../lib/firebaseAdmin.ts";
import { db } from "../db"; // ✅ Drizzle DB इंस्टेंस को इम्पोर्ट करें
import { users } from "../../shared/backend/schema"; // ✅ Users स्कीमा को इम्पोर्ट करें
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs'; // ✅ bcrypt को इम्पोर्ट करें

const saltRounds = 10; // bcrypt की जटिलता। 10 एक अच्छा डिफ़ॉल्ट है।

// ===========================================
// ✅ पासवर्ड हैशिंग फंक्शंस
// ===========================================

/**
 * पासवर्ड को हैश करता है।
 * @param password The plain text password to hash.
 * @returns A Promise that resolves with the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

/**
 * एक प्लेनटेक्स्ट पासवर्ड की तुलना उसके हैशेड संस्करण से करता है।
 * @param plainPassword The plain text password entered by the user.
 * @param hashedPassword The hashed password stored in the database.
 * @returns A Promise that resolves with true if passwords match, false otherwise.
 */
export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  const match = await bcrypt.compare(plainPassword, hashedPassword);
  return match;
}


// ===========================================
// ✅ Firebase Token Verification & Role Check Function
// ===========================================

/**
 * Firebase ID Token को सत्यापित (verify) करता है, UID को डीकोड करता है, 
 * और डेटाबेस में यूजर रोल की जाँच करता है।
 * @param token क्लाइंट द्वारा भेजा गया Firebase ID Token.
 * @param requiredRole आवश्यक रोल (जैसे 'admin', 'seller', 'customer'). वैकल्पिक।
 * @returns {Promise<DecodedIdToken>} सफलतापूर्वक सत्यापित और अधिकृत (authorized) टोकन.
 */
export async function verifyAndDecodeToken(token: string, requiredRole?: string) {
  let decodedToken;
  try {
    // 1. Firebase Token Verification
    decodedToken = await authAdmin.verifyIdToken(token);
  } catch (error) {
    console.error("❌ Firebase token verification failed:", error);
    throw new Error("Invalid or expired token");
  }
  
  // 2. Database Role Check (यदि requiredRole निर्दिष्ट है)
  if (requiredRole) {
      const firebaseUid = decodedToken.uid;
      
      // Drizzle का उपयोग करके डेटाबेस में यूजर को UID से खोजें
      const userEntry = await db
          .select()
          .from(users)
          .where(eq(users.firebaseUid, firebaseUid))
          .limit(1);

      if (userEntry.length === 0) {
          console.error(`❌ User not found in DB for UID: ${firebaseUid}`);
          throw new Error("User profile not found. Please complete registration.");
      }

      const user = userEntry[0]; // यूजर ऑब्जेक्ट प्राप्त करें
      const userRole = user.role; // मान लें कि users स्कीमा में 'role' कॉलम है

      // 3. Role Authorization Check
      if (userRole !== requiredRole) {
          console.error(`❌ Access denied for user: ${firebaseUid}. Required role: ${requiredRole}, Found role: ${userRole}`);
          throw new Error("Access denied. Insufficient permissions.");
      }
  }

  return decodedToken;
}
