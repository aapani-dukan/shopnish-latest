"use client";

import { useEffect, useState } from "react"; 
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

  // 1. Fully Authenticated ho jaye to redirect karein
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // 2. Google Sign-In Trigger
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

  // --- RENDER LOGIC ---

  // CASE 1: Agar Modal active hai (Priority Return)
  if (mustSyncPhone) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-md p-4 animate-in fade-in zoom-in duration-300">
          <PhoneSyncModal 
            isOpen={true} 
            tempData={tempData}
            onSuccess={() => {
              setMustSyncPhone(false);
              window.location.replace("/"); // Sab saaf karke home par jao
            }}
          />
          {/* Safety Text: Agar Modal render hone mein der kare */}
          <p className="text-center text-muted-foreground text-xs mt-4 animate-pulse">
            Verifying your details...
          </p>
        </div>
      </div>
    );
  }

  // CASE 2: Normal Login Screen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="p-10 bg-white rounded-3xl shadow-2xl border border-slate-100 text-center max-w-md w-full relative overflow-hidden">
        {/* Decorative Background Element */}
        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
        
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Shopnish</h1>
          <p className="text-slate-500 font-medium italic">Apne business ki nayi pehchan</p>
        </div>
        
        <div className="space-y-6">
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isLoadingAuth} 
            className="w-full py-8 text-lg bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-orange-500 shadow-sm transition-all rounded-2xl group"
          >
            {isLoadingAuth ? (
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-500" />
            ) : (
              <GoogleIcon className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform" />
            )}
            {isLoadingAuth ? "Checking account..." : "Continue with Google"}
          </Button>
          
          <p className="text-[11px] text-slate-400 leading-relaxed">
            By continuing, you agree to our <br />
            <span className="text-orange-600 underline cursor-pointer font-semibold">Terms of Service</span> and <span className="text-orange-600 underline cursor-pointer font-semibold">Privacy Policy</span>.
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-400 font-medium">© 2026 Shopnish Tech</p>
    </div>
  );
}