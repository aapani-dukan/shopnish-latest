"use client";

import { useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { PhoneSyncModal } from "@/components/auth/PhoneSyncModal"; 
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { 
    signIn, 
    isAuthenticated, 
    isLoadingAuth, 
    mustSyncPhone, 
    tempData, 
    setMustSyncPhone 
  } = useAuth();
  
  const navigate = useNavigate();

  // 1. Success Redirect
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // 2. Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      const response = await signIn(true); 
      if (response?.needsPhone) {
        setMustSyncPhone(true); 
      }
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // --- RENDER LOGIC: Switch Pattern ---

  // 🚩 CASE 1: Agar Phone Sync zaroori hai, toh Login UI ko RENDER HI MAT KARO
  // Isse loop physically toot jayega kyunki button screen par bachega hi nahi.
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md">
          <PhoneSyncModal 
            isOpen={true} 
            tempData={tempData}
            onSuccess={() => {
              setMustSyncPhone(false);
              window.location.replace("/"); 
            }}
          />
          {/* Safety message agar modal render na ho */}
          <p className="text-center text-sm text-gray-500 mt-8 animate-pulse">
            Verifying your account details...
          </p>
        </div>
      </div>
    );
  }

  // 🚩 CASE 2: Normal Login UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900">Shopnish</h1>
          <p className="text-gray-500 mt-2">Apne business ko digital banayein</p>
        </div>
        
        <Button 
          onClick={handleGoogleSignIn} 
          disabled={isLoadingAuth} 
          className="w-full py-7 text-lg bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-orange-500 transition-all rounded-2xl"
        >
          {isLoadingAuth ? (
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-500" />
          ) : (
            <GoogleIcon className="mr-3 w-6 h-6" />
          )}
          {isLoadingAuth ? "Checking..." : "Continue with Google"}
        </Button>
      </div>
    </div>
  );
}