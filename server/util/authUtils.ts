// server/util/authUtils.ts

// ✅ 'admin' के बजाय 'authAdmin' को इम्पोर्ट करें
// सुनिश्चित करें कि पाथ सही है
import { authAdmin } from "../lib/firebaseAdmin.ts"; // .js एक्सटेंशन सही है यदि यह ESM है

export async function verifyAndDecodeToken(token: string) {
  try {
    // ✅ 'admin.auth()' के बजाय सीधे 'authAdmin.verifyIdToken()' का उपयोग करें
    const decodedToken = await authAdmin.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("❌ Firebase token verification failed:", error);
    throw new Error("Invalid or expired token");
  }
}
