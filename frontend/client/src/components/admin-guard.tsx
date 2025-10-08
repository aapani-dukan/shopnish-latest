// ✅ client/src/components/admin-guard.tsx (सुधार)
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoadingAuth } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        if (!user?.idToken) {
          setIsAuthenticated(false);
          return;
        }
        const userData = await apiRequest(
          "GET",
          "/api/users/me",
          undefined,
          user.idToken
        );
        
        if (userData.role === "admin") {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Failed to check admin session:", e);
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkAdminSession();
  }, [user?.idToken]);

  if (isLoadingAuth || isChecking) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
