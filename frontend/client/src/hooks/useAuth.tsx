import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
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
 signIn: (usePopup?: boolean) => Promise<AuthResponse | null>;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<AuthResponse | null>; clearError: () => void;
 
  signOut: () => Promise<void>;
  refetchUser: () => void;
  backendLogin: (email: string, password: string) => Promise<User>; // Delivery/Backend-only login
  
  signUpWithEmailAndPassword: (email: string, password: string) => Promise<FirebaseUser | null>;
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

  
    // status <--- यह 'status' variable यहाँ से हटा दें, यह एक mistake है
const fetchAndSyncBackendUser = useCallback(
  async (fbUser: FirebaseUser, forceRefreshIdToken: boolean = false) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    let dbUserData: any = null;
    let isAdminFromFirebase = false;

    try {
      const idTokenResult = await fbUser.getIdTokenResult(forceRefreshIdToken);
      const idToken = idTokenResult.token;
      isAdminFromFirebase = idTokenResult.claims.admin === true;

      // --- STEP A: Profile Check ---
      try {
        const res = await apiRequest("GET", "/api/users/me");
        dbUserData = res.user || res;
        
        // 🚩 CHECK: User hai par Phone nahi hai? Toh sync par bhejo!
        if (dbUserData && !dbUserData.phone) {
           console.log("Profile found but phone missing. Triggering Modal.");
           setIsLoadingAuth(false);
           setIsAuthenticated(false);
           setTempData({
    firebaseUid: fbUser.uid,
    email: fbUser.email || "",
    fullName: fbUser.displayName || "User"
  });
  setMustSyncPhone(true);
           return { 
             needsPhone: true, 
             tempData: { firebaseUid: fbUser.uid, email: fbUser.email, fullName: fbUser.displayName } 
           };
        }

        // Agar user + phone dono hain, toh seedha andar
        if (dbUserData && dbUserData.phone) {
          const newUserData: User = {
            uid: fbUser.uid,
            id: dbUserData.id,
            email: fbUser.email || dbUserData.email,
            name: fbUser.displayName || dbUserData.name,
            role: dbUserData.role || "customer",
            idToken,
            sellerProfile: dbUserData.sellerProfile || null,
            deliveryBoyId: dbUserData.deliveryBoyId || null,
            isAdmin: isAdminFromFirebase,
          };
          setUser(newUserData);
          setIsAuthenticated(true);
          setIsAdmin(newUserData.isAdmin);
          setIsLoadingAuth(false);
          return { needsPhone: false, user: newUserData };
        }
      } catch (e: any) {
        console.warn("User profile not found. Moving to initial-login.");
      }

      // --- STEP B: Initial Login Check ---
      const res = await apiRequest("POST", "/api/auth/initial-login", { idToken });

      if (res.needsPhone) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        return { 
          needsPhone: true, 
          tempData: { ...res.tempData, fullName: fbUser.displayName } 
        };
      }

      dbUserData = res.user;

    } catch (err: any) {
      console.error("❌ Auth Sync Error:", err);
      setAuthError(err);
      setIsLoadingAuth(false);
      return { error: err };
    }

    // FINAL STEP: Syncing complete
    if (dbUserData) {
      const finalUser: User = {
        uid: fbUser.uid,
        id: dbUserData.id,
        email: fbUser.email || dbUserData.email,
        name: fbUser.displayName || dbUserData.name,
        role: dbUserData.role || "customer",
        idToken: await fbUser.getIdToken(),
        sellerProfile: dbUserData.sellerProfile || null,
        deliveryBoyId: dbUserData.deliveryBoyId || null,
        isAdmin: isAdminFromFirebase || dbUserData.isAdmin || false,
      };
      setUser(finalUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      return { needsPhone: false, user: finalUser };
    }

    setIsLoadingAuth(false);
  },
  []
);
// ✅ 2. Google Sign-In Handler
const signIn = useCallback(
  async (usePopup: boolean = false): Promise<AuthResponse | null> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const fbUser = await firebaseSignInWithGoogle(usePopup);
      if (fbUser) {
        // Backend se pucho: "Bhai, iska phone linked hai kya?"
       const result = await fetchAndSyncBackendUser(fbUser);
        return result as AuthResponse;
      }
      return null;
    } catch (err: any) {
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
      return null;
    } catch (err: any) {
      setAuthError(err as AuthError);
      setIsLoadingAuth(false);
      throw err;
    }
  },
  [fetchAndSyncBackendUser]
);

// ✅ 4. onAuthStateChanged (The Guard)
// ✅ 4. onAuthStateChanged (The Guard)
useEffect(() => {
  const checkRedirectResult = async () => {
    try { 
      await firebaseHandleRedirectResult(); 
    } catch (e) { 
      console.error("Redirect error:", e); 
    }
  };
  checkRedirectResult();

  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      if (!fbUser.email) {
        setIsLoadingAuth(false);
        return;
      }

      // 🚩 LOOP BREAKER: Agar Modal pehle se active hai, toh dobara sync na karein
      if (mustSyncPhone) {
        console.log("Modal already active, skipping sync check.");
        setIsLoadingAuth(false); // Ensure loading is off
        return; 
      }

      // Agar user login hai par hamare context (state) mein data nahi hai
      if (!user || user.uid !== fbUser.uid) {
        // Sync check (forceRefresh false rakhein normal flow mein)
        const res = await fetchAndSyncBackendUser(fbUser, false);
        
        // 🔥 Phone missing handle ho chuka hai fetchAndSyncBackendUser ke andar
        if (res?.needsPhone) {
          console.log("OnAuthStateChanged: User needs phone sync.");
          setIsLoadingAuth(false); // Modal dikhane ke liye loading band karein
        }
      } else {
        // Agar user pehle se synced hai, toh loading band karo
        setIsLoadingAuth(false);
      }
    } else {
      // 🚪 Logout flow
      setUser(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      queryClient.clear();
      setIsLoadingAuth(false);
    }
  });

  return () => unsubscribe();
}, [fetchAndSyncBackendUser, queryClient, user, mustSyncPhone]); // ✅ perfect dependencies
  // --- Email/Password Sign Up Handler (No change) ---
  const signUpWithEmailAndPassword = useCallback(
    async (email: string, password: string): Promise<FirebaseUser | null> => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const fbUser = await firebaseSignUpWithEmail(email, password);
        return fbUser; 
      } catch (err: any) {
        setAuthError(err as AuthError);
        setIsLoadingAuth(false);
        throw err;
      }
    },
    [] 
  );

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
  const authContextValue = useMemo( // ✅ camelCase
    () => ({
      user,
      isLoadingAuth, // ✅ camelCase
      isAuthenticated, // ✅ camelCase
            isAdmin, // ✅ camelCase
      error: authError, // ✅ camelCase
      mustSyncPhone, // ✅ camelCase
      setMustSyncPhone, // ✅ camelCase
      tempData, // ✅ camelCase
      clearError, // ✅ camelCase
      signIn, // ✅ camelCase
      signOut, // ✅ camelCase
      refetchUser, // ✅ camelCase
      backendLogin, // ✅ camelCase
      signInWithEmailAndPassword, // ✅ camelCase
      signUpWithEmailAndPassword, // ✅ camelCase
      resetPassword, // ✅ camelCase
    }),
    [
      user,
      isLoadingAuth,
      isAuthenticated,
      isAdmin,
      authError,
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
