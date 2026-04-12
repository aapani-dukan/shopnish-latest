import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth"; 

const AdminGuard = () => { 
  const { isLoadingAuth, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  // 🚩 Naya Check: Kya session mein password verify hua hai?
  // Iska data hum login ke waqt localStorage ya context mein rakhenge
  const isAdminPasswordVerified = localStorage.getItem("admin_password_verified") === "true";

  useEffect(() => {
    if (isLoadingAuth) return;

    // 1. Pehla Naka: Login aur Admin Flag check
    if (!isAuthenticated || !isAdmin) {
      console.warn("Unauthorized access attempt.");
      navigate("/login", { replace: true }); // Pehle normal login karwao
      return;
    }

    // 2. Doosra Naka: Admin Password Verification check
    // Agar login hai, admin hai, lekin password nahi dala, toh password page par bhejo
    if (!isAdminPasswordVerified) {
      console.warn("Admin Password required.");
      navigate("/sh-admin-login", { replace: true }); 
    }
    
  }, [isLoadingAuth, isAuthenticated, isAdmin, isAdminPasswordVerified, navigate]);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center py-20 text-lg font-semibold text-blue-600 animate-pulse">
          <p>Verifying Admin Privileges...</p>
        </div>
      </div>
    ); 
  }

  // ✅ SIRF TABHI DASHBOARD DIKHAO JAB TEENO CHEEZEIN SAHI HON:
  // 1. Login ho (isAuthenticated)
  // 2. SQL se admin ho (isAdmin)
  // 3. Password dala ho (isAdminPasswordVerified)
  if (isAuthenticated && isAdmin && isAdminPasswordVerified) {
      return <Outlet />; 
  }

  return null;
};

export default AdminGuard;