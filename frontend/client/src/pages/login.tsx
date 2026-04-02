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

  // ✅ 1. Navigation Logic: Full login (with phone) ke baad hi dashboard
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // ✅ 2. Login Handler
  const handleGoogleSignIn = async () => {
    // Agar modal khula hai ya user pehle se login hai, toh click block karo
    if (mustSyncPhone || isAuthenticated) return;

    try {
      await signIn(true);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // 🚩 3. PHONE SYNC SCREEN (Priority Render)
  // Jab mustSyncPhone true hoga, tab niche wala pura UI render hi nahi hoga.
  // Isse loop physically break ho jayega.
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white px-4">
        {/* Background Spinner taaki screen blank na lage */}
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
          <p className="text-slate-500 font-bold animate-pulse tracking-tight">
            Account setup kar rahe hain...
          </p>
        </div>
        
        {/* Modal Entry */}
        <PhoneSyncModal 
          isOpen={true} 
          tempData={tempData}
          onSuccess={() => {
            // Modal state clean up useAuth mein hi handle ho raha hai
            navigate("/", { replace: true });
          }}
        />
        
        {/* Modal visibility safety check */}
        <div className="absolute bottom-10 text-[10px] text-slate-300 uppercase tracking-widest">
          Secure Identity Verification
        </div>
      </div>
    );
  }

  // 🚩 4. NORMAL LOGIN UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 overflow-hidden">
      <div className="p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center max-w-md w-full transition-all duration-300">
        
        <div className="mb-10">
          <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-orange-100">
             <span className="text-4xl">🛒</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">Shopnish</h1>
          <p className="text-slate-400 mt-2 font-medium italic">
            "Apne business ko digital banayein"
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isLoadingAuth} 
            className="w-full py-8 text-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-orange-400 transition-all rounded-2xl shadow-sm disabled:opacity-80"
          >
            {isLoadingAuth ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-600" />
                Verifying...
              </>
            ) : (
              <>
                <GoogleIcon className="mr-3 w-6 h-6" />
                Continue with Google
              </>
            )}
          </Button>
          
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium px-4">
            By continuing, you agree to Shopnish's <span className="text-orange-500 underline underline-offset-2">Terms</span> and <span className="text-orange-500 underline underline-offset-2">Privacy Policy</span>.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-50">
          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
            © 2026 Shopnish Tech
          </p>
        </div>
      </div>
    </div>
  );
}