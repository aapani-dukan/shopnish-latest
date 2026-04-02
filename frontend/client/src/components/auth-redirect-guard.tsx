// client/src/components/auth-redirect-guard.tsx
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation, Outlet } from "react-router-dom";

const AuthRedirectGuard = () => {
  const { isAuthenticated, isLoadingAuth, mustSyncPhone } = useAuth(); // 👈 mustSyncPhone yahan se nikalo
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // 🚩🔥 Sabse bada Loop Breaker:
  // Agar phone sync pending hai, toh redirect MAT KARO. 
  // User ko wahi rehne do jahan LoginPage modal dikha raha hai.
  if (mustSyncPhone) {
    return <Outlet />; 
  }

  if (!isAuthenticated) {
    // 🚩 Yahan dhyaan dena: Agar aapka LoginPage '/login' par hai, 
    // toh niche '/auth' ko '/login' se badal dena.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />; 
};

export default AuthRedirectGuard;