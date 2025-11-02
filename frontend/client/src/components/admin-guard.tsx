// ✅ client/src/components/admin-guard.tsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoadingAuth } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // ⚡ केवल तब चेक करो जब user load हो चुका हो
    if (isLoadingAuth) return;
    if (!user?.idToken) {
      setIsAuthenticated(false);
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    const checkAdminSession = async () => {
      try {
        const userData = await apiRequest(
          "GET",
          "/api/users/me",
          undefined,
          user.idToken
        );

        if (!cancelled) {
          setIsAuthenticated(userData.role === "admin");
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to check admin session:", e);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, [user?.idToken, isLoadingAuth]); // dependency सही रखी लेकिन controlled

  // ✅ Loading phase: redirect नहीं करना
  if (isLoadingAuth || isChecking) {
    return <div className="text-center py-10">Loading...</div>;
  }

  // ✅ जब confirm हो जाए कि admin नहीं है
  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }

  // ✅ सब ठीक है → children दिखाओ
  return <>{children}</>;
};

export default AdminGuard;
