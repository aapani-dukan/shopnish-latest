
// ✅ client/src/components/admin-guard.tsx
import React, { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom"; // Outlet को इंपोर्ट करें
import { useAuth } from "../hooks/useAuth"; 

// अब children प्रॉप की कोई आवश्यकता नहीं है
const AdminGuard = () => { 
  
  const { user, isLoadingAuth, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // ⚡ केवल तब चेक करें जब AuthContext लोडिंग खत्म कर चुका हो
    if (isLoadingAuth) return;

    // यदि authenticated नहीं है या admin नहीं है, तो redirect करें
    if (!isAuthenticated || !isAdmin) {
      console.warn("AdminGuard: User not authenticated or not an admin. Redirecting to /admin-login.");
      // Replace: true का उपयोग करें ताकि back button से वापस न आ सकें
      navigate("/admin-login", { replace: true }); 
    }
    // यदि authenticated और admin है, तो useEffect चुपचाप खत्म हो जाएगा
    
  }, [isLoadingAuth, isAuthenticated, isAdmin, navigate]);

  // ✅ Loading phase: 
  if (isLoadingAuth) {
    return (
      <div className="text-center py-20 text-lg font-semibold text-gray-600">
        <p>Loading Admin Panel...</p>
      </div>
    ); 
  }

  // ✅ यदि सुरक्षा जाँच पास हो जाती है, तो Outlet को रेंडर करें।
  //    Outlet नेस्टेड रूट्स (AdminLayout) को रेंडर करेगा।
  //    यदि जाँच फेल हुई है, तो useEffect पहले ही navigate कर चुका होगा।
  //    हम यह भी सुनिश्चित करते हैं कि यह तभी रेंडर हो जब isAuthenticated और isAdmin दोनों TRUE हों।
  if (isAuthenticated && isAdmin) {
      return <Outlet />; // Outlet नेस्टेड <Route> (AdminLayout) को रेंडर करेगा
  }

  // यदि लोडिंग समाप्त हो गई है लेकिन न तो एडमिन है और न ही ऑथेंटिकेटेड, 
  // तो navigate हो चुका होगा, लेकिन फॉलबैक के रूप में खाली रेंडर (null) करें
  return null;
};

export default AdminGuard;
