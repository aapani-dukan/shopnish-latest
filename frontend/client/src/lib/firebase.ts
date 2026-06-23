import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  User as FirebaseUserType,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from "firebase/auth";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "@/config/firebaseKeys";

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// --- 📱 Mobile OTP Authentication Functions ---

/**
 * ✅ 1. Recaptcha Setup
 * OTP bhejne ke liye invisible recaptcha ka use karenge.
 */
export const setupRecaptcha = (containerId: string) => {
  if (!(window as any).recaptchaVerifier) {
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      'size': 'invisible', // Invisible rakhne se user experience disturb nahi hota
      'callback': () => {
        console.log("✅ Recaptcha verified successfully");
      },
      'expired-callback': () => {
        console.warn("⚠️ Recaptcha expired, please try again.");
      }
    });
  }
  return (window as any).recaptchaVerifier;
};

/**
 * ✅ 2. Phone Number OTP Request
 */
export const signInWithPhone = async (
  phoneNumber: string, 
  appVerifier: any
): Promise<ConfirmationResult> => {
  try {
    return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  } catch (error: any) {
    console.error("❌ Firebase Phone Auth Error:", error);
    throw {
      code: error.code || "auth/phone-error",
      message: error.message || "Failed to send OTP",
    } as AuthError;
  }
};

/**
 * ✅ 3. Sign Out
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log("Firebase: User signed out.");
  } catch (error: any) {
    console.error("Firebase signOut error:", error);
    throw error;
  }
};

// --- Types & Exports ---

export interface AuthError {
  code: string;
  message: string;
  details?: string;
}

export type User = FirebaseUserType;

export { onAuthStateChanged, app };
export { signOutUser as logout };