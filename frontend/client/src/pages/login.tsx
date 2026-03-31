"use client";

import { useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { PhoneSyncModal } from "@/components/auth/PhoneSyncModal"; 
import { Loader2 } from "lucide-react"; // Loading spinner ke liye

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

  // 1. Manual Login Handler
  const handleGoogleSignIn = async () => {
    try {
      const response = await signIn(true); // Popup flow
      
      // Agar backend bole ki phone setup zaroori hai
      if (response?.needsPhone) {
        setMustSyncPhone(true); 
      }
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // 2. Navigation Logic: Fully login hone par redirect
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // --- RENDER LOGIC: Modal priority sabse upar ---

  // 🚩 CASE 1: Agar Phone Sync ki zaroorat hai (Modal Screen)
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <PhoneSyncModal 
          isOpen={true} 
          tempData={tempData}
          onSuccess={() => {
            setMustSyncPhone(false);
            // Link hone ke baad seedha dashboard par
            window.location.href = "/"; 
          }}
        />
        {/* Background text taaki khali na lage */}
        <div className="text-white text-sm animate-pulse">Finishing your profile...</div>
      </div>
    );
  }

  // 🚩 CASE 2: Normal Login UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-2xl shadow-xl border border-gray-100 text-center max-w-md w-full">
        <div className="mb-6">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">Shopnish</h1>
          <p className="mt-2 text-gray-500 font-medium">Apne business ko digital banayein</p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isLoadingAuth} 
            className="w-full py-7 text-lg bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all rounded-xl"
          >
            {isLoadingAuth ? (
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-500" />
            ) : (
              <GoogleIcon className="mr-3 w-6 h-6" />
            )}
            {isLoadingAuth ? "Checking account..." : "Continue with Google"}
          </Button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Secure Authentication</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            By continuing, you agree to our <span className="underline cursor-pointer">Terms</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>

      {/* Ek chota sa footer info */}
      <p className="mt-8 text-sm text-gray-400">© 2026 Shopnish Tech</p>
    </div>
  );
}