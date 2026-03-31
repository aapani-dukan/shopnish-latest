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
  const [showContent, setShowContent] = useState(false);

  // 1. Mount effect: Layout shift se bachne ke liye
  useEffect(() => {
    setShowContent(true);
  }, []);

  // 2. Navigation Logic: Jab sync aur auth dono clear hon
  useEffect(() => {
    if (isAuthenticated && !mustSyncPhone) {
      navigate("/");
    }
  }, [isAuthenticated, mustSyncPhone, navigate]);

  // 3. Manual Login Handler
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

  if (!showContent) return null;

  // --- RENDER LOGIC ---

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 overflow-hidden">
      
      {/* 📱 CASE 1: Phone Sync Modal (Overlay Mode) */}
      {mustSyncPhone && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-500">
          <div className="w-full max-w-md p-4 transform animate-in fade-in zoom-in duration-300">
            <PhoneSyncModal 
              isOpen={true} 
              tempData={tempData}
              onSuccess={() => {
                setMustSyncPhone(false);
                // Force refresh taaki states clean ho jayein
                window.location.replace("/"); 
              }}
            />
            <p className="text-white/60 text-center text-xs mt-6 tracking-widest uppercase">
              Secure Verification Process
            </p>
          </div>
        </div>
      )}

      {/* 🚩 CASE 2: Main Login UI */}
      {/* Hum ise blur kar denge agar modal khula hai */}
      <div className={`p-8 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center max-w-md w-full transition-all duration-500 ${mustSyncPhone ? 'blur-xl scale-95 opacity-0' : 'opacity-100 scale-100'}`}>
        <div className="mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
             <span className="text-3xl">🛍️</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Shopnish</h1>
          <p className="mt-2 text-gray-500 font-medium italic">"Bhai, apna dhanda ab online!"</p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isLoadingAuth || mustSyncPhone} 
            className="w-full py-8 text-lg bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-orange-300 shadow-md transition-all rounded-2xl group"
          >
            {isLoadingAuth ? (
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-orange-500" />
            ) : (
              <GoogleIcon className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform" />
            )}
            {isLoadingAuth ? "Checking account..." : "Continue with Google"}
          </Button>
        </div>
        
        <div className="mt-10 pt-6 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-tighter text-gray-400 font-bold mb-3">100% Safe & Secure</p>
          <p className="text-[11px] text-gray-400 leading-relaxed px-4">
            By joining, you agree to Shopnish's <span className="text-orange-500 underline cursor-pointer">Terms</span> and <span className="text-orange-500 underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>

      {/* Footer */}
      {!mustSyncPhone && (
        <p className="absolute bottom-8 text-sm text-gray-400 font-medium">
          Made with ❤️ in India
        </p>
      )}
    </div>
  );
}