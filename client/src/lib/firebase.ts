import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
  // 🚀 New Imports for Email/Password Auth & Credential
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // 👇 New Import for Native Login via Token
  signInWithCredential,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "firebase/auth";

// ... (existing firebaseConfig and setup) ...

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
// 🚀 New function to export
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  try {
    await firebaseSendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Firebase Password Reset Error:", error);
    // You should wrap Firebase error here if you use AuthError type globally
    throw error;
  }
};

// ... (existing provider scope and interfaces) ...

export interface AuthError {
  code: string;
  message: string;
  details?: string;
}

export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

// ----------------------------------------------------
// ✅ New: Sign In with Credential (Native/Token Login)
// ----------------------------------------------------
/**
 * Signs in a user using an ID Token obtained from a native (Android/iOS) SDK.
 * This is crucial for enabling a native Google Sign-In experience in a hybrid app.
 */
export const signInWithNativeCredential = async (idToken: string): Promise<User> => {
    try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        console.log("Native Credential Sign In successful:", userCredential.user.email);
        return userCredential.user;
    } catch (error: any) {
        console.error("Native Credential Sign In Error:", error);
        throw {
            code: error.code || "auth/native-signin-error",
            message: error.message || "Failed to sign in with native token",
            details: error.toString(),
        } as AuthError;
    }
};
// ----------------------------------------------------

// ----------------------------------------------------
// Existing: Sign Up with Email and Password
// ----------------------------------------------------
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
// ... (implementation remains the same)
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("Email Sign Up successful:", userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error("Email Sign Up Error:", error);
    throw {
      code: error.code || "auth/signup-error",
      message: error.message || "Failed to sign up with email and password",
      details: error.toString(),
    } as AuthError;
  }
};

// ----------------------------------------------------
// Existing: Sign In with Email and Password
// ----------------------------------------------------
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
// ... (implementation remains the same)
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Email Sign In successful:", userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error("Email Sign In Error:", error);
    throw {
      code: error.code || "auth/signin-error",
      message: error.message || "Failed to sign in with email and password",
      details: error.toString(),
    } as AuthError;
  }
};


export const signInWithGoogle = async (
// ... (existing signInWithGoogle implementation) ...
  usePopup: boolean = false
): Promise<User | null> => {
  try {
    console.log(
      `Attempting Google sign-in using ${usePopup ? "popup" : "redirect"} flow...`
    );

    if (usePopup) {
      console.log("Starting popup authentication...");
      const result = await signInWithPopup(auth, provider);
      console.log("Popup authentication successful:", result.user.email);
      return result.user;
    } else {
      console.log("Starting redirect authentication...");
      await signInWithRedirect(auth, provider);
      console.log("Redirect initiated, page will reload...");
      return null;
    }
  } catch (error: any) {
    console.error("Authentication error:", error);

    if (error.code === "auth/web-storage-unsupported" && !usePopup) {
      console.log("Storage unsupported, trying popup fallback...");
      return await signInWithGoogle(true);
    }

    if (error.code === "auth/unauthorized-domain") {
      throw {
        code: error.code,
        message: "This domain is not authorized for Google sign-in.",
        details:
          "Please add this domain to Firebase Console → Authentication → Settings → Authorized domains. Current domain needs to be added to Firebase configuration.",
      } as AuthError;
    }

    throw {
      code: error.code || "auth/signin-error",
      message: error.message || "Failed to sign in with Google",
      details: `Error: ${error.toString()}. Check console for more details.`,
    } as AuthError;
  }
};

export const handleRedirectResult = async (): Promise<AuthResult> => {
// ... (existing handleRedirectResult implementation) ...
  try {
    const result = await getRedirectResult(auth);

    if (result) {
      const user = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential?.accessToken) {
        sessionStorage.setItem("google_access_token", credential.accessToken);
      }

      return { user, error: null };
    }

    return { user: null, error: null };
  } catch (error: any) {
    let authError: AuthError;

    switch (error.code) {
      case "auth/account-exists-with-different-credential":
        authError = {
          code: error.code,
          message:
            "An account already exists with the same email address but different sign-in credentials.",
          details:
            "Please sign in using the original method you used to create this account.",
        };
        break;
      case "auth/cancelled-popup-request":
        authError = {
          code: error.code,
          message: "Sign-in was cancelled by the user.",
          details: "The authentication process was interrupted.",
        };
        break;
      case "auth/network-request-failed":
        authError = {
          code: error.code,
          message: "Network error occurred during authentication.",
          details: "Please check your internet connection and try again.",
        };
        break;
      case "auth/web-storage-unsupported":
        authError = {
          code: error.code,
          message: "Web storage is not supported or disabled.",
          details:
            "This browser does not support or has disabled cookies/local storage required for authentication.",
        };
        break;
      default:
        authError = {
          code: error.code || "auth/unknown-error",
          message:
            error.message ||
            "An unexpected error occurred during authentication.",
          details:
            "Third-party storage access may be blocked by your browser. Please check your browser settings or try a different browser.",
        };
    }

    return { user: null, error: authError };
  }
};

export const signOutUser = async (): Promise<void> => {
// ... (existing signOutUser implementation) ...
  try {
    await signOut(auth);
    sessionStorage.removeItem("google_access_token");
    console.log("Firebase: User signed out.");
  } catch (error: any) {
    console.error("Firebase signOut error:", error);
    throw {
      code: error.code || "auth/signout-error",
      message: error.message || "Failed to sign out",
      details: error.toString(),
    } as AuthError;
  }
};

export { onAuthStateChanged };

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const checkBrowserCompatibility = (): {
// ... (existing checkBrowserCompatibility implementation) ...
  isCompatible: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];
  let isCompatible = true;

  const userAgent = navigator.userAgent;
  const isChrome = userAgent.includes("Chrome");
  const isFirefox = userAgent.includes("Firefox");
  const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");

  if (isChrome) {
    warnings.push(
      "Chrome 115+ may block third-party storage access. Ensure cookies are enabled."
    );
  }
  if (isFirefox) {
    warnings.push(
      "Firefox 109+ may block third-party storage access. Check privacy settings."
    );
  }
  if (isSafari) {
    warnings.push(
      'Safari 16.1+ may block third-party storage access. Disable "Prevent cross-site tracking" for this site.'
    );
  }

  if (!navigator.cookieEnabled) {
    warnings.push(
      "Cookies are disabled. Please enable cookies for authentication to work."
    );
    isCompatible = false;
  }

  return { isCompatible, warnings };
};

export { app };
export { signOutUser as logout };
export const signInWithGooglePopup = () => signInWithGoogle(true);
