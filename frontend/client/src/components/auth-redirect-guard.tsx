// client/src/components/auth-redirect-guard.tsx

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";

const AuthRedirectGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // अगर लॉग इन नहीं है, तो लॉगिन पेज पर रीडायरेक्ट करें
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // अगर उपयोगकर्ता लॉग इन है, तो बच्चों को रेंडर करें।
  return <>{children}</>;
};

export default AuthRedirectGuard;
