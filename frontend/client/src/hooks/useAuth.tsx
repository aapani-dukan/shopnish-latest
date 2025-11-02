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

interface AuthContextType {
  user: User | null;
 isLoadingAuth : boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: AuthError | null;
  clearError: () => void;
  signIn: (usePopup?: boolean) => Promise<FirebaseUser | null>; // Google Auth
  signOut: () => Promise<void>;
  refetchUser: () => void;
  backendLogin: (email: string, password: string) => Promise<User>; // Delivery/Backend-only login
  signInWithEmailAndPassword: (email: string, password: string) => Promise<FirebaseUser | null>;
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

  const clearError = useCallback(() => { // ✅ camelCase
    setAuthError(null);
  }, []);

  const fetchAndSyncBackendUser = useCallback(async (fbUser: FirebaseUser, forceRefreshIdToken: boolean = false) => {
    setIsLoadingAuth(true);
    let dbUserData = null;
    // status <--- यह 'status' variable यहाँ से हटा दें, यह एक mistake है

    const idTokenResult = await fbUser.getIdTokenResult(forceRefreshIdToken);
    const idToken = idTokenResult.token;
    const isAdminFromFirebase = idTokenResult.claims.admin === true; // Firebase claim

    try {
      const res = await apiRequest("GET", "/api/users/me"); // ✅ camelCase
      dbUserData = res.user || res;
      console.log("✅ Backend user data fetched:", dbUserData);
    } catch (e: any) {
      if (e.status === 404) {
        console.warn("User not found on backend. Attempting initial login.");
        try {
          const res = await apiRequest("POST", "/api/auth/initial-login", {
            idToken,
          });
          dbUserData = res.user;
          console.log("✅ New user profile created via initial login.");
        } catch (initialLoginError: any) { // ✅ camelCase
          console.error("❌ Initial login failed:", initialLoginError);
          setAuthError(initialLoginError);
          setUser(null);
          setIsAuthenticated(false);
          setIsAdmin(false);
          setIsLoadingAuth(false);
          return;
        }
      } else {
        console.error("❌ Failed to fetch backend user data:", e);
        setAuthError(e);
        setUser(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsLoadingAuth(false);
        return;
      }
    }

    if (dbUserData) {
        const newUserData: User = { // ✅ camelCase
            uid: fbUser.uid,
            id: dbUserData.id,
            email: fbUser.email || dbUserData.email,
            name: fbUser.displayName || dbUserData.name, // ✅ displayName
            role: dbUserData.role || "customer",
            idToken,
            sellerProfile: dbUserData.sellerProfile || null, // ✅ camelCase
            deliveryBoyId: dbUserData.deliveryBoyId || null, // ✅ camelCase
            isAdmin: isAdminFromFirebase, // Use Firebase claim for isAdmin
        };

        // 🚀 Add this console.log for debugging
        console.log("AuthContext: newUserData after fetch:", newUserData); 

        // ✅ FIXED: Add user.isAdmin to comparison and set isAdmin correctly
        if (!user || user.uid !== newUserData.uid || user.idToken !== newUserData.idToken || user.role !== newUserData.role || user.isAdmin !== newUserData.isAdmin) {
            setUser(newUserData);
            setIsAuthenticated(true);
            setIsAdmin(newUserData.isAdmin); // ✅ Set isAdmin from newUserData.isAdmin (which uses Firebase claim)
        }
    }

    setIsLoadingAuth(false);
  }, [user]); // 'user' dependency

// ... (onAuthStateChanged useEffect) ...
  useEffect(() => {
  const checkRedirectResult = async () => {
    try {
      await firebaseHandleRedirectResult();
    } catch (error) {
      console.error("Error handling redirect result:", error);
    }
  };
  checkRedirectResult();

  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    console.log("onAuthStateChanged triggered. fbUser:", fbUser ? fbUser.email : "null");

    if (fbUser) {
      if (!user || user.uid !== fbUser.uid) {
        await fetchAndSyncBackendUser(fbUser, true);
      } else {
        setIsLoadingAuth(false);
      }
    } else {
      console.warn("❌ No Firebase user. Clearing state.");
      setUser(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      queryClient.clear();
      setIsLoadingAuth(false);
    }
  });

  return () => unsubscribe();
}, [fetchAndSyncBackendUser, queryClient, user]);

  const signIn = useCallback(
    async (usePopup: boolean = false): Promise<FirebaseUser | null> => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const fbUser = await firebaseSignInWithGoogle(usePopup);
        if (fbUser) {
          await fetchAndSyncBackendUser(fbUser);
        }
        return fbUser;
      } catch (err: any) {
        setAuthError(err as AuthError);
        setIsLoadingAuth(false);
        throw err;
      }
    },
    [fetchAndSyncBackendUser]
  );
  
  // --- Email/Password Sign In Handler (No change) ---
  const signInWithEmailAndPassword = useCallback(
    async (email: string, password: string): Promise<FirebaseUser | null> => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const fbUser = await firebaseSignInWithEmail(email, password);
        if (fbUser) {
          await fetchAndSyncBackendUser(fbUser);
        }
        return fbUser;
      } catch (err: any) {
        setAuthError(err as AuthError);
        setIsLoadingAuth(false);
        throw err;
      }
    },
    [fetchAndSyncBackendUser]
  );
  
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
          email: backendUser.email,
          name: backendUser.name,
          role: backendUser.role,
          sellerProfile: backendUser.sellerProfile || null,
deliveryBoyId: backendUser.deliveryBoyId || null, 
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
