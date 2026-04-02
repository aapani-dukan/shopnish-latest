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
    tempData 
  } = useAuth();
  
  const navigate = useNavigate();

  // ✅ Navigation Logic
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

 const handleGoogleSignIn = async () => {
  // 🔥 सबसे जरूरी line
  if (mustSyncPhone || isAuthenticated) {
    console.log("⛔ Login blocked (modal active या already logged in)");
    return;
  }

  try {
    await signIn(true);
  } catch (err) {
    console.error("Login Error:", err);
  }
};

  // 🚩 SAFETY: अगर phone sync required है लेकिन tempData नहीं है
  if (mustSyncPhone && !tempData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Something went wrong. Please refresh.</p>
      </div>
    );
  }

  // 🚩 PHONE SYNC SCREEN (FULL BLOCK)
  if (mustSyncPhone) {
    return (
      <PhoneSyncModal 
        isOpen={true} 
        tempData={tempData}
      onSuccess={() => {
          navigate("/", { replace: true });
}}
      />
    );
  }

  // 🚩 NORMAL LOGIN UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full">
        
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-900">Shopnish</h1>
          <p className="text-gray-500 mt-2 font-medium">
            Apne business ko digital banayein
          </p>
        </div>
        
       <Button 
  onClick={handleGoogleSignIn} 
  disabled={isLoadingAuth || mustSyncPhone} // 🔥 isAuthenticated हटाओ
  className="w-full py-7 text-lg bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all rounded-2xl disabled:opacity-60 disabled:cursor-not-allowed"
>
  {isLoadingAuth ? (
    <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-500" />
  ) : (
    <GoogleIcon className="mr-3 w-6 h-6" />
  )}
  {isLoadingAuth 
    ? "Checking..." 
    : mustSyncPhone 
      ? "Complete Profile First" // 🔥 UX improvement
      : "Continue with Google"}
</Button>

      </div>
    </div>
  );
}