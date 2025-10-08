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
  idToken?: string;
}

interface AuthContextType {
  user: User | null;
  isLoadingAuth: boolean;
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
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const queryClient = useQueryClient();

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // ✅ Consolidated logic for fetching and syncing backend user (No change)
  const fetchAndSyncBackendUser = useCallback(async (fbUser: FirebaseUser) => {
    setIsLoadingAuth(true);
    let dbUserData = null;
    const idToken = await fbUser.getIdToken(true);

    try {
      // ✅ 1. Attempt to fetch existing user data
      const res = await apiRequest("GET", "/api/users/me");
      dbUserData = res.user || res;
      console.log("✅ Backend user data fetched:", dbUserData);
    } catch (e: any) {
      if (e.status === 404) {
        // ✅ 2. If 404, attempt to create a new user
        console.warn("User not found on backend. Attempting initial login.");
        try {
          const res = await apiRequest("POST", "/api/auth/initial-login", {
            idToken,
          });
          dbUserData = res.user;
          console.log("✅ New user profile created via initial login.");
        } catch (initialLoginError: any) {
          // This handles any other errors during initial login (e.g., 401)
          console.error("❌ Initial login failed:", initialLoginError);
          setAuthError(initialLoginError);
          setUser(null);
          setIsAuthenticated(false);
          setIsAdmin(false);
          setIsLoadingAuth(false);
          return; // Exit the function
        }
      } else {
        // Handle any other non-404 errors from the GET request
        console.error("❌ Failed to fetch backend user data:", e);
        setAuthError(e);
        setUser(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsLoadingAuth(false);
        return; // Exit the function
      }
    }

    // ✅ 3. If we have data, set the state
    if (dbUserData) {
      const newUserData: User = {
        uid: fbUser.uid,
        id: dbUserData.id,
        email: fbUser.email || dbUserData.email,
        name: fbUser.displayName || dbUserData.name,
        role: dbUserData.role || "customer",
        idToken,
        sellerProfile: dbUserData.sellerProfile || null,
      };
      setUser(newUserData);
      setIsAuthenticated(true);
      setIsAdmin(newUserData.role === "admin");
    }

    setIsLoadingAuth(false);
  }, []);

  // ✅ Firebase + Backend sync Listener (No change)
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
      console.log(
        "onAuthStateChanged triggered. fbUser:",
        fbUser ? fbUser.email : "null"
      );

      if (fbUser) {
        // Only run fetchAndSync if user data is not yet loaded
        if (!user || user.uid !== fbUser.uid) {
            await fetchAndSyncBackendUser(fbUser);
        } else {
            // Already authenticated and synced, just update loading state
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

  // --- Google Sign In Handler (No change) ---
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
      clearError,
      signIn,
      signOut,
      refetchUser,
      backendLogin,
      signInWithEmailAndPassword,
      signUpWithEmailAndPassword,
      // 🚀 New addition
      resetPassword,
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
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
