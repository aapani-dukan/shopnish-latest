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

  // Navigation Logic
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

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

  // 🚩 STEP 1: Agar Modal active hai, toh Pura Page badal do
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center">
          <PhoneSyncModal 
            isOpen={true} 
            tempData={tempData}
            onSuccess={() => {
              setMustSyncPhone(false);
              window.location.replace("/"); 
            }}
          />
          {/* Ek backup spinner agar modal load hone mein time le */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="text-gray-500 text-sm animate-pulse">Setting up your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // 🚩 STEP 2: Normal Login UI (Ye tabhi dikhega jab mustSyncPhone false ho)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900">Shopnish</h1>
          <p className="text-gray-500 mt-2 font-medium">Apne business ko digital banayein</p>
        </div>
        
        <Button 
          onClick={handleGoogleSignIn} 
          disabled={isLoadingAuth} 
          className="w-full py-7 text-lg bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all rounded-2xl"
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