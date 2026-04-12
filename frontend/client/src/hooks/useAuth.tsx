import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { User as FirebaseUser, ConfirmationResult } from "firebase/auth"; // ConfirmationResult add kiya
import { useQueryClient } from "@tanstack/react-query";
import {
  auth,
  onAuthStateChanged,
  signOutUser,
  AuthError,
  // 🚀 New: Inhe hum Phone Auth ke liye use karenge
  setupRecaptcha, 
  signInWithPhone,
} from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

// --- Updated Types ---
export interface User {
  id?: string;
  uid?: string;
  phoneNumber: string | null; 
  email?: string | null; // optional rakh sakte hain agar future mein email bhi add karna ho
  name: string | null;
  role: "customer" | "seller" | "admin" | "delivery-boy";
  sellerProfile?: any | null;
  deliveryBoyId?: number | null; 
  idToken?: string;
  isAdmin: boolean;
  isDelivery?: boolean;
  isSeller?: boolean;
  sellerApprovalStatus?: "pending" | "approved" | "rejected" | null;
  
}

interface AuthContextType {
  user: User | null;
  isLoadingAuth: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: AuthError | null;
  // OTP logic ke liye naye fields
  sendOtp: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOtp: (confirmationResult: ConfirmationResult, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refetchUser: () => void;
}
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const queryClient = useQueryClient();

  const clearError = useCallback(() => setAuthError(null), []);

  // ✅ 1. Backend User Sync (Simple & Clean)
  // Ab ye sirf UID se backend user mangwayega
  const fetchAndSyncBackendUser = useCallback(
    async (fbUser: FirebaseUser) => {
      setIsLoadingAuth(true);
      try {
        const idToken = await fbUser.getIdToken(true);
        
        // Backend se profile mangwao (verifyToken handle kar lega registration check)
        const res = await apiRequest("GET", "/api/users/me");
        const dbUserData = res;

        if (dbUserData) {
          const finalUser: User = {
            uid: fbUser.uid,
            id: dbUserData.id,
            phoneNumber: fbUser.phoneNumber || dbUserData.phone,
            name: dbUserData.firstName ? `${dbUserData.firstName} ${dbUserData.lastName || ""}` : "User",
            role: dbUserData.role,
            idToken: idToken,
            sellerProfile: dbUserData.sellerProfile || null,
            deliveryBoyId: dbUserData.deliveryBoyId || null,
            isAdmin: !!dbUserData.isAdmin,
          };

          setUser(finalUser);
          setIsAuthenticated(true);
          setIsAdmin(finalUser.isAdmin);
        }
      } catch (err: any) {
        console.error("❌ Auth Sync Error:", err);
        // Agar profile nahi hai, toh registration flow par bhejenge (login.tsx mein handle hoga)
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    },
    []
  );

 
// ✅ 2. OTP Sending Logic (Cleaned & Error-Proof)
  const sendOtp = useCallback(async (phoneNumber: string) => {
    setAuthError(null);
    try {
      // 🚩 Sabse Pehle: Purane Recaptcha ko window se saaf karo
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          const container = document.getElementById('otp-container');
          if (container) container.innerHTML = ''; // Container khali karo
        } catch (e) {
          console.warn("Recaptcha cleanup warning:", e);
        }
      }

      // 🚩 Phir: Naya verifier setup karo
      const verifier = setupRecaptcha('otp-container'); 
      const confirmation = await signInWithPhone(phoneNumber, verifier);
      return confirmation;
    } catch (err: any) {
      console.error("❌ Send OTP Error:", err);
      setAuthError(err);
      throw err;
    }
  }, []);

  // ✅ 3. OTP Verification Logic (Sync Fixed)
  const verifyOtp = useCallback(async (confirmationResult: ConfirmationResult, code: string) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const result = await confirmationResult.confirm(code);
      if (result.user) {
        // Backend sync (Ab hamara /users/me auto-register karega)
        await fetchAndSyncBackendUser(result.user);
        
        // 🚩 Success: Recaptcha ko memory se hata do
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
        }
      }
    } catch (err: any) {
      console.error("❌ OTP Verification Error:", err);
      setAuthError(err);
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [fetchAndSyncBackendUser]);
// --- STEP 1: Main Auth Guard (The Engine) ---
  // Ye check karta hai ki user logged in hai ya nahi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Agar Firebase mein user hai, toh backend se profile fetch/sync karo
        await fetchAndSyncBackendUser(fbUser);
      } else {
        // Agar logged out hai, toh saari states clear karo
        setUser(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [fetchAndSyncBackendUser]);

  // --- STEP 2: Sign Out Handler ---
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutUser();
      console.log("✅ User signed out successfully.");
      setAuthError(null);
      setUser(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      queryClient.clear(); // Purana data clear karein safety ke liye
    } catch (err: any) {
      setAuthError(err as AuthError);
      throw err;
    }
  }, [queryClient]);

  // --- STEP 3: Refetch User ---
  const refetchUser = useCallback(async () => {
    setIsLoadingAuth(true);
    const fbUser = auth.currentUser;
    if (fbUser) {
      await fetchAndSyncBackendUser(fbUser);
    } else {
      setIsLoadingAuth(false);
    }
  }, [fetchAndSyncBackendUser]);

  // ✅ Final Context Value (Cleaned for Mobile-First)
  const authContextValue = useMemo(
    () => ({
      user,
      isLoadingAuth,
      isAuthenticated,
      isAdmin,
      error: authError,
      sendOtp,      // 👈 Naya (Phone Auth)
      verifyOtp,    // 👈 Naya (Phone Auth)
      signOut,
      clearError,
      refetchUser,
    }),
    [
      user,
      isLoadingAuth,
      isAuthenticated,
      isAdmin,
      authError,
      sendOtp,
      verifyOtp,
      signOut,
      clearError,
      refetchUser,
    ]
  );

  return (
    <AuthContext.Provider value={authContextValue as any}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};