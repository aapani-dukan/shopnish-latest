"use client";

import { useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { PhoneSyncModal } from "@/components/auth/PhoneSyncModal"; 

export default function LoginPage() {
  // ✅ useAuth se global sync states nikaali
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
      const response = await signIn(); 
      
      // Agar manual click par response mein needsPhone aata hai
      if (response?.needsPhone) {
        setMustSyncPhone(true); 
      }
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // 2. Navigation Logic: Jab user fully authenticated ho aur modal ki zaroorat na ho
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // Debugging ke liye logs
  useEffect(() => {
    console.log("Current Auth State:", { isAuthenticated, isLoadingAuth, mustSyncPhone });
  }, [isAuthenticated, isLoadingAuth, mustSyncPhone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="p-8 bg-white rounded-xl shadow-lg text-center max-w-md w-full">
        <h1 className="text-3xl font-extrabold mb-2 text-gray-800">Shopnish</h1>
        <p className="mb-8 text-gray-500 text-sm">Apne business ko digital banayein</p>
        
        <Button 
          onClick={handleGoogleSignIn} 
          disabled={isLoadingAuth || mustSyncPhone} 
          className="w-full py-6 text-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
        >
          <GoogleIcon className="mr-3 w-6 h-6" />
          {isLoadingAuth ? "Checking account..." : "Continue with Google"}
        </Button>
        
        <p className="mt-6 text-xs text-gray-400">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>

      {/* 📱 Modal ab Global State 'mustSyncPhone' se control ho raha hai */}
      {mustSyncPhone && (
        <PhoneSyncModal 
          isOpen={mustSyncPhone}
          tempData={tempData} // Global context se data aa raha hai
          onSuccess={() => {
            setMustSyncPhone(false); // Modal band karo
            // navigate("/") ki zaroorat nahi, upar wala useEffect handle kar lega
          }}
        />
      )}
    </div>
  );
}