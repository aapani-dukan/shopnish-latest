"use client";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { PhoneSyncModal } from "@/components/auth/PhoneSyncModal"; 
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function LoginPage() {
  const { signIn, mustSyncPhone, setMustSyncPhone, setTempData, tempData, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  // 🚀 Direct Login Handler (No Background Effects)
  const handleLogin = async () => {
    try {
      const fbUser = await signIn(true) as any; // Popup flow
      if (!fbUser) return;

      // Seedha Backend Check
      const res = await api.get("/api/users/me");
      
      if (res.data.exists && res.data.user?.phone) {
        navigate("/", { replace: true });
      } else {
        // Data set karo aur modal dikhao
        setTempData({ 
          uid: fbUser.uid, 
          email: fbUser.email, 
          name: fbUser.displayName 
        });
        setMustSyncPhone(true);
      }
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  // 🚩 GUARD: Modal Active State (Iske aage niche ka code render nahi hoga)
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto" />
          <p className="text-slate-500 font-bold animate-pulse">Setup Pending...</p>
        </div>
        <PhoneSyncModal 
          isOpen={true} 
          tempData={tempData}
          onSuccess={() => navigate("/", { replace: true })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center max-w-sm w-full">
        <div className="mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <span className="text-3xl">🛒</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900">Shopnish</h1>
          <p className="text-slate-400 text-sm">Apne business ko digital banayein</p>
        </div>
        
        <Button 
          onClick={handleLogin} 
          disabled={isLoadingAuth} 
          className="w-full py-7 text-lg bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-50 rounded-2xl transition-all"
        >
          {isLoadingAuth ? (
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          ) : (
            <><GoogleIcon className="mr-3 w-5 h-5" /> Google Se Login Karein</>
          )}
        </Button>

        <p className="mt-6 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          © 2026 Shopnish Tech
        </p>
      </div>
    </div>
  );
}