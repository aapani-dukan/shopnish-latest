"use client";

import { useState, useEffect } from "react"; // ✅ React import zaroori hai
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";
import { PhoneSyncModal } from "@/components/auth/PhoneSyncModal"; 

export default function LoginPage() {
  const { signIn, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [tempUserData, setTempUserData] = useState<any>(null);

  const handleGoogleSignIn = async () => {
    try {
      // ✅ Tip: Login shuru hone par modal state reset karein
      setShowPhoneModal(false); 
      
      const response = await signIn(); 
      
      if (response?.needsPhone) {
        setTempUserData(response.tempData);
        setShowPhoneModal(true);
      }
      // Note: Agar response.user milta hai toh useAuth ka internal state 
      // isAuthenticated ko true kar dega aur useEffect navigate kar dega.
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !showPhoneModal) {
      navigate("/");
    }
  }, [isAuthenticated, navigate, showPhoneModal]);
useEffect(() => {
  console.log("Current Auth State:", { isAuthenticated, isLoadingAuth });
}, [isAuthenticated, isLoadingAuth]);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="p-8 bg-white rounded-xl shadow-lg text-center max-w-md w-full">
        <h1 className="text-3xl font-extrabold mb-2 text-gray-800">Shopnish</h1>
        <p className="mb-8 text-gray-500 text-sm">Apne business ko digital banayein</p>
        
        <Button 
          onClick={handleGoogleSignIn} 
          disabled={isLoadingAuth || showPhoneModal} // ✅ Modal khula ho tab bhi button disable rakhein
          className="w-full py-6 text-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
        >
          {/* ✅ Icon ki sizing aur margin ekdum perfect hai ab */}
          <GoogleIcon className="mr-3 w-6 h-6" />
          {isLoadingAuth ? "Checking account..." : "Continue with Google"}
        </Button>
        
        <p className="mt-6 text-xs text-gray-400">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>

      {showPhoneModal && (
        <PhoneSyncModal 
          isOpen={showPhoneModal}
          tempData={tempUserData}
          onSuccess={(_user) => {
            setShowPhoneModal(false);
            // ✅ Yahan ensure karein ki navigation tabhi ho jab state update ho jaye
            setTimeout(() => navigate("/"), 100); 
          }}
        />
      )}
    </div>
  );
}