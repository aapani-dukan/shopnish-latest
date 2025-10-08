// client/src/pages/login.tsx
"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; // ✅ useAuth हुक को इंपोर्ट करें
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/ui/GoogleIcon";

export default function LoginPage() {
  const { signIn, isLoadingAuth, isAuthenticated, error } = useAuth(); // ✅ useAuth हुक का उपयोग करें
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    // isLoadingAuth के कारण `loading` स्टेट की जरूरत नहीं है, क्योंकि हुक इसे संभालता है
    try {
      // ✅ सीधे useAuth से signIn फ़ंक्शन को कॉल करें
      const fbUser = await signIn();
      
      if (fbUser) {
        // हुक अब Backend कॉल को संभालेगा, इसलिए हमें यहाँ कुछ नहीं करना है
        // हुक के useEffect में नेविगेशन होगा
      }

    } catch (err) {
      console.error("Google Sign-In Error:", err);
      // useAuth हुक एरर को संभालता है, इसलिए यहाँ `alert` की जरूरत नहीं है
    }
  };

  // ✅ जबisAuthenticated true हो तो नेविगेट करें
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome</h1>
        <p className="mb-6 text-gray-600">Sign in to continue</p>
        <Button onClick={handleGoogleSignIn} disabled={isLoadingAuth} className="w-full">
          <GoogleIcon className="mr-2" />
          {isLoadingAuth ? "Signing in..." : "Login with Google"}
        </Button>
      </div>
    </div>
  );
}
