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
   // setMustSyncPhone // ✅ Context se state nikaali
  } = useAuth();
  
  const navigate = useNavigate();

  // ✅ 1. Navigation Logic: Full login ke baad hi dashboard bhejo
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // ✅ 2. Login Handler
  const handleGoogleSignIn = async () => {
    if (mustSyncPhone || isAuthenticated) return;

    try {
      await signIn(true);
      // Note: useAuth ka useEffect khud hi check karke mustSyncPhone trigger karega
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // 🚩 3. PHONE SYNC SCREEN (Full Block Layout)
  if (mustSyncPhone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
        {/* Background mein spinner taaki screen empty na lage */}
        <Loader2 className="h-10 w-10 animate-spin text-orange-500 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Account setup kar rahe hain...</p>
        
        <PhoneSyncModal 
          isOpen={true} 
          tempData={tempData}
          onSuccess={() => {
            // Modal khud hi state clean kar raha hai, 
            // bas navigate trigger kar do
            navigate("/", { replace: true });
          }}
        />
      </div>
    );
  }

  // 🚩 4. NORMAL LOGIN UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center max-w-md w-full transition-all">
        
        <div className="mb-10">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
             <span className="text-3xl">🛒</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900">Shopnish</h1>
          <p className="text-gray-400 mt-2 font-medium italic">
            "Apne business ko digital banayein"
          </p>
        </div>
        
        <Button 
          onClick={handleGoogleSignIn} 
          disabled={isLoadingAuth || mustSyncPhone} 
          className="w-full py-8 text-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-orange-500 transition-all rounded-2xl shadow-sm disabled:opacity-70"
        >
          {isLoadingAuth ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-600" />
              Checking...
            </>
          ) : (
            <>
              <GoogleIcon className="mr-3 w-6 h-6" />
              Continue with Google
            </>
          )}
        </Button>

        <p className="mt-8 text-[11px] text-gray-400 leading-relaxed uppercase tracking-widest font-bold">
          100% Secure Authentication
        </p>
      </div>
      
      <p className="mt-8 text-sm text-gray-400">© 2026 Shopnish Tech</p>
    </div>
  );
}