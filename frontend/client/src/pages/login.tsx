"use client";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { Loader2 } from "lucide-react";


export default function LoginPage() {
  const { 
    signIn, 
    isLoadingAuth 
  } = useAuth();
  
  const navigate = useNavigate();

  // 🚀 Login Handler
  const handleLogin = async () => {
    try {
      // 1. Google Popup Open Karein
      const result = await signIn(true); 
      
      // Agar user ne popup band kar diya ya error aaya
      if (!result) return;

      // 2. Check Karein ki phone verification ki zaroorat hai?
      // Note: result humein useAuth ke fetchAndSyncBackendUser se mil raha hai
      if (result.needsPhone) {
        console.log("Redirecting to Sync Page...");
        
        // Data pehle se useAuth mein set ho chuka hai, bas navigate karna hai
        navigate("/sync-phone", { replace: true });
      } else {
        // Sab sahi hai, dashboard chalo
        console.log("Login Success, going to home.");
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      // Agar kuch samajh na aaye toh safety ke liye sync page par bhej sakte hain
      if (err.message?.includes("404") || err.message?.includes("not found")) {
         navigate("/sync-phone");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="p-10 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center max-w-sm w-full transition-all duration-300">
        
        {/* Logo Section */}
        <div className="mb-10">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
             <span className="text-4xl text-white">🛒</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Shopnish</h1>
          <p className="text-slate-400 mt-2 font-medium">
            Apne business ko digital banayein
          </p>
        </div>
        
        {/* Action Button */}
        <div className="space-y-4">
          <Button 
            onClick={handleLogin} 
            disabled={isLoadingAuth} 
            className="w-full py-8 text-xl bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-orange-500 transition-all rounded-2xl shadow-sm flex items-center justify-center gap-3 disabled:opacity-70 active:scale-95"
          >
            {isLoadingAuth ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                <span className="font-bold">Verifying...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="w-6 h-6" /> 
                <span className="font-bold">Google Se Login Karein</span>
              </>
            )}
          </Button>
          
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium px-4">
            By continuing, you agree to Shopnish's <span className="text-orange-600 underline">Terms</span> and <span className="text-orange-600 underline">Privacy</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-50">
          <p className="text-[10px] text-slate-300 uppercase tracking-[0.3em] font-black">
            © 2026 Shopnish Tech
          </p>
        </div>
      </div>
    </div>
  );
}