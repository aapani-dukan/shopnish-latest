import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,

} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  auth,
  onAuthStateChanged,
  handleRedirectResult as firebaseHandleRedirectResult,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutUser,
  AuthError,
  signInWithEmail as firebaseSignInWithEmail,
  signUpWithEmail as firebaseSignUpWithEmail,
  // 🚀 New: Import reset password function
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

// --- Types (No changes) ---
export interface SellerInfo {
  id: string;
  userId: string;
  businessName: string;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  [key: string]: any;
}

export interface User {
  id?: string;
  uid?: string;
  email: string | null;
  name: string | null;
  role: "customer" | "seller" | "admin" | "delivery";
  sellerProfile?: SellerInfo | null;
deliveryBoyId?: number | null; 
  idToken?: string;
  isAdmin: boolean;
}
// ✅ Ye interface add karein
interface AuthResponse {
  needsPhone?: boolean; // '?' matlab ye optional hai
  tempData?: {
    firebaseUid: string;
    email: string;
    fullName: string;
  };
  user?: User | null;
  error?: any;
}

// Aur signIn function ka type aise set karein:
// signIn: () => Promise<AuthResponse>;
interface AuthContextType {
  user: User | null;
 isLoadingAuth : boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: AuthError | null;
  mustSyncPhone: boolean; 
  setMustSyncPhone: (val: boolean) => void;
  tempData: any;
  setTempData: React.Dispatch<React.SetStateAction<any>>;
 signIn: (usePopup?: boolean) => Promise<AuthResponse | null>;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<AuthResponse | null>; clearError: () => void;
  signUpWithEmailAndPassword: (email: string, password: string) => Promise<FirebaseUser | null>;
  signOut: () => Promise<void>;
  refetchUser: () => void;
  backendLogin: (email: string, password: string) => Promise<User>; // Delivery/Backend-only login
  
  
  // 🚀 New: Password reset function
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

 
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // ✅ camelCase
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ camelCase
  const [isAdmin, setIsAdmin] = useState(false); // ✅ camelCase
  const [authError, setAuthError] = useState<AuthError | null>(null); // ✅ camelCase
  const queryClient = useQueryClient(); // ✅ camelCase
const [mustSyncPhone, setMustSyncPhone] = useState(false);
const [tempData, setTempData] = useState<any>(null);
  const clearError = useCallback(() => { // ✅ camelCase
    setAuthError(null);
  }, []);

  // ✅ 1. Master Sync Function
const fetchAndSyncBackendUser = useCallback(
  async (fbUser: FirebaseUser, forceRefreshIdToken: boolean = false) => {
    // 🚩 IMPORTANT: Syncing shuru hone se pehle state set karein
    setIsLoadingAuth(true);
    setAuthError(null);

    let idToken = "";
    let dbUserData: any = null;
    let isAdminFromFirebase = false;

    try {
      // Tokens mangwayein
      idToken = await fbUser.getIdToken(forceRefreshIdToken);
      const idTokenResult = await fbUser.getIdTokenResult();
      isAdminFromFirebase = idTokenResult.claims.admin === true;

      // --- STEP A: Profile Check ---
      try {
        const res = await apiRequest("GET", "/api/users/me");
        dbUserData = res.user || res;

        // User profile mil gayi par phone nahi hai
        if (dbUserData && !dbUserData.phone) {
          console.log("🚩 Profile exists but phone missing. Triggering Sync Redirect.");
          
          const syncData = {
            firebaseUid: fbUser.uid,
            email: fbUser.email || "",
            fullName: fbUser.displayName || "User"
          };

          setTempData(syncData);
          setMustSyncPhone(true);
          
          // User ko authenticate rakhein taaki AuthRedirectGuard usey sync page tak jane de
          setIsAuthenticated(true); 
          setIsLoadingAuth(false);
          return { needsPhone: true, tempData: syncData };
        }
      } catch (e) {
        console.warn("User profile not found, checking initial-login...");
      }

      // --- STEP B: Initial Login Check (Naye users ke liye) ---
      if (!dbUserData) {
        const res = await apiRequest("POST", "/api/auth/initial-login", { idToken });
        
        if (res.needsPhone) {
          const syncData = { ...res.tempData, fullName: fbUser.displayName };
          setTempData(syncData);
          setMustSyncPhone(true);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          return { needsPhone: true, tempData: syncData };
        }
        dbUserData = res.user;
      }

      // --- FINAL STEP: Full User Setup ---
      if (dbUserData) {
        const finalUser: User = {
          uid: fbUser.uid,
          id: dbUserData.id,
          email: fbUser.email || dbUserData.email,
          name: fbUser.displayName || dbUserData.name,
          role: dbUserData.role || "customer",
          idToken: idToken,
          sellerProfile: dbUserData.sellerProfile || null,
          deliveryBoyId: dbUserData.deliveryBoyId || null,
          isAdmin: isAdminFromFirebase || dbUserData.is_admin || dbUserData.role === "admin",
        };

        setUser(finalUser);
        setIsAuthenticated(true);
        setIsAdmin(finalUser.isAdmin);
        setMustSyncPhone(false); // Phone mil gaya, sync band
        setIsLoadingAuth(false);
        return { needsPhone: false, user: finalUser };
      }

    } catch (err: any) {
      console.error("❌ Auth Sync Error:", err);
      setAuthError(err);
      setIsLoadingAuth(false);
      return { error: err };
    }

    setIsLoadingAuth(false);
    return null;
  },
  [] // 🚩 Dependency array empty rakhein taaki loop na bane
);

// ✅ 2. Google Sign-In Handler
const signIn = useCallback(
  async (usePopup: boolean = false): Promise<AuthResponse | null> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const fbUser = await firebaseSignInWithGoogle(usePopup);
      if (fbUser) {
        // Backend sync call karein aur result return karein
        const result = await fetchAndSyncBackendUser(fbUser);
        return result as AuthResponse;
      }
      setIsLoadingAuth(false);
      return null;
    } catch (err: any) {
      console.error("Sign In Error:", err);
      setAuthError(err as AuthError);
      setIsLoadingAuth(false);
      throw err;
    }
  },
  [fetchAndSyncBackendUser]
);

// ✅ 3. Email/Password Sign-In Handler
const signInWithEmailAndPassword = useCallback(
  async (email: string, password: string): Promise<any> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const fbUser = await firebaseSignInWithEmail(email, password);
      if (fbUser) {
        return await fetchAndSyncBackendUser(fbUser);
      }
      setIsLoadingAuth(false);
      return null;
    } catch (err: any) {
      setAuthError(err as AuthError);
      setIsLoadingAuth(false);
      throw err;
    }
  },
  [fetchAndSyncBackendUser]
);
    
// ✅ signUpWithEmailAndPassword function define karein
const signUpWithEmailAndPassword = useCallback(
  async (email: string, password: string): Promise<any> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const fbUser = await firebaseSignUpWithEmail(email, password);
      // Signup ke baad humein backend sync ki zaroorat nahi hoti turant, 
      // kyunki naya user hamesha 'initial-login' flow se guzrega.
      return fbUser; 
    } catch (err: any) {
      setAuthError(err as AuthError);
      setIsLoadingAuth(false);
      throw err;
    }
  },
  [] 
);
// --- STEP 1: Loop Se Bachne Ke Liye Ek Constant Ref (Component ke bahar ya andar) ---
const isSyncingRef = useRef(false);

// --- STEP 2: Redirect Check (Ye sirf Page Load par 1 baar chalega) ---
useEffect(() => {
  const handleRedirect = async () => {
    try {
      await firebaseHandleRedirectResult();
    } catch (e) {
      console.error("Redirect check failed:", e);
    }
  };
  handleRedirect();
}, []); // 👈 Empty array matlab sirf mounting par chalega, loop nahi karega

// --- STEP 3: Main Auth Guard (The Guard) ---
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      // 🚩 Loop todne ke liye: Agar pehle se isAuthenticated hai toh dubara sync mat karo
      if (isSyncingRef.current) return;
      
      isSyncingRef.current = true;
      await fetchAndSyncBackendUser(fbUser);
      isSyncingRef.current = false;
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setMustSyncPhone(false);
      setIsLoadingAuth(false);
    }
  });
  return () => unsubscribe();
}, [fetchAndSyncBackendUser]); // ✅ fetch function dependency mein dalo
  // --- 🚀 New: Password Reset Handler ---
  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      setAuthError(null);
      try {
        // Call the imported Firebase utility function
        await firebaseSendPasswordResetEmail(email);
        // Do not set loading state here, as it's a non-auth flow
      } catch (err: any) {
        setAuthError(err as AuthError);
        throw err;
      }
    },
    [] 
  );


  // --- Sign Out Handler (No change) ---
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutUser();
      console.log("✅ User signed out.");
      setAuthError(null);
      setUser(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      queryClient.clear();
    } catch (err: any) {
      setAuthError(err as AuthError);
      throw err;
    }
  }, [queryClient]);

  // --- Refetch User Handler (No change) ---
  const refetchUser = useCallback(async () => {
    setIsLoadingAuth(true);
    const fbUser = auth.currentUser;
    if (fbUser) {
      await fetchAndSyncBackendUser(fbUser);
    } else {
      setIsLoadingAuth(false);
    }
  }, [fetchAndSyncBackendUser]);

  // --- Backend Login Handler (No change) ---
  const backendLogin = useCallback(
    async (email: string, password: string): Promise<User> => {
      setAuthError(null);
      setIsLoadingAuth(true);
      try {
        const res = await apiRequest("POST", "/api/delivery/login", {
          email,
          password,
        });
        const backendUser = res.user;
        if (!backendUser)
          throw new Error("Invalid user data received from backend.");
        const newUserData: User = {
          id: backendUser.id,
          uid: backendUser.firebaseUid || "",
          email: backendUser.email,
          name: backendUser.name,
          role: backendUser.role,
          sellerProfile: backendUser.sellerProfile || null,
deliveryBoyId: backendUser.deliveryBoyId || null, 
isAdmin: backendUser.role === "admin",
        };
        setUser(newUserData);
        setIsAuthenticated(true);
        setIsAdmin(newUserData.role === "admin");
        console.log("✅ Delivery backend login success:", newUserData);
        setIsLoadingAuth(false);
        return newUserData;
      } catch (err: any) {
        console.error("❌ Delivery backend login failed:", err);
        setAuthError(err as AuthError);
        setIsLoadingAuth(false);
        throw err;
      }
    },
    []
  );
  const authContextValue = useMemo(
  () => ({
    user,
    isLoadingAuth,
    isAuthenticated,
    isAdmin,
    error: authError,
    mustSyncPhone, // ✅ 
    setMustSyncPhone, // ✅ 
    tempData, // ✅ 
    setTempData,
    clearError,
    signIn,
    signOut,
    refetchUser,
    backendLogin,
    signInWithEmailAndPassword,
    signUpWithEmailAndPassword,
    resetPassword,
  }),
  [
    user,
    isLoadingAuth,
    isAuthenticated,
    isAdmin,
    authError,
    mustSyncPhone,    // 👈 Missing tha, add kar diya
    setMustSyncPhone, // 👈 Missing tha, add kar diya
    tempData, 
    setTempData,
    clearError,
    signIn,
    signOut,
    refetchUser,
    backendLogin,
    signInWithEmailAndPassword,
    signUpWithEmailAndPassword,
    resetPassword,
  ]
);
  return (
    <AuthContext.Provider value={authContextValue}> {/* ✅ camelCase */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => { // ✅ camelCase
  const ctx = useContext(AuthContext); // ✅ camelCase
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider"); // ✅ camelCase
  return ctx;
};
