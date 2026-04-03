"use client";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function LoginPage() {
  const { signIn, setMustSyncPhone, setTempData, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      // 1. Firebase Popup Login
      const fbUser = await signIn(true) as any; 
      if (!fbUser) return;

      // 2. Backend se check karo profile
      const res = await api.get("/api/users/me");
      
      if (res.data.exists && res.data.user?.phone) {
        // ✅ Sab sahi hai, dashboard jao
        navigate("/", { replace: true });
      } else {
        // 🚩 Phone missing hai, data save karo aur redirect karo
        setTempData({ 
          uid: fbUser.uid, 
          email: fbUser.email, 
          name: fbUser.displayName 
        });
        setMustSyncPhone(true);
        navigate("/sync-phone", { replace: true }); // Modal ki jagah naya page!
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      // Agar backend error de (user not found), toh bhi sync page par bhej sakte hain
      navigate("/sync-phone");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center max-w-sm w-full transition-all duration-300">
        
        <div className="mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-200">
             <span className="text-3xl">🛒</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Shopnish</h1>
          <p className="text-slate-400 text-sm font-medium">Apne business ko digital banayein</p>
        </div>
        
        <Button 
          onClick={handleLogin} 
          disabled={isLoadingAuth} 
          className="w-full py-8 text-lg bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-orange-400 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {isLoadingAuth ? (
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          ) : (
            <>
              <GoogleIcon className="w-5 h-5" /> 
              <span className="font-bold">Google Se Login Karein</span>
            </>
          )}
        </Button>

        <div className="mt-8 pt-6 border-t border-slate-50">
          <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em] font-black">
            © 2026 Shopnish Tech
          </p>
        </div>
      </div>
    </div>
  );
}