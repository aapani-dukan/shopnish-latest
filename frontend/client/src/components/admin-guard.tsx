
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





{/*// src/components/admin-guard.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';

// **********************************************
// WARNING: यह कोड सुरक्षा की जाँच नहीं करता है।
// यह केवल टेस्टिंग के लिए है कि कंपोनेंट क्रैश हो रहा है या नहीं।
// **********************************************

const SimpleAdminGuard = () => {
  // गार्ड का काम है, अगर यूजर एडमिन न हो तो उसे '/admin-login' पर भेजना।
  // लेकिन टेस्टिंग के लिए, हम सिर्फ़ कंपोनेंट को लोड करेंगे।

  return (
    <div style={{ border: '2px dashed red', padding: '10px' }}>
      <p>✅ AdminGuard Test Passed (Ignoring Security Checks)</p>
      <Outlet /> 
    </div>
  );
};

export default SimpleAdminGuard;


*/}



{/*
// ✅ client/src/components/admin-guard.tsx
import React, { useEffect, useState } from "react"; // ✅ camelCase
import { useNavigate } from "react-router-dom"; // ✅ useNavigate hook का उपयोग करें
import { useAuth } from "../hooks/useAuth"; // ✅ Correct relative path, camelCase
// apiRequest अब admin status check करने के लिए आवश्यक नहीं है, इसलिए इसे हटा दिया गया है
// import { apiRequest } from "../lib/queryclient"; 

const AdminGuard = ({ children }: { children: React.ReactNode }) => { // ✅ camelCase
  // ✅ IMPORTANT: isAdmin को useAuth से destructure करें
  const { user, isLoadingAuth, isAuthenticated, isAdmin } = useAuth(); // ✅ camelCase
  const navigate = useNavigate(); // ✅ useNavigate hook

  // 🚀 AdminGuard अब अपनी खुद की authenticated state को नहीं रखेगा
  //    यह सीधे AuthContext से isAuthenticated और isAdmin पर निर्भर करेगा
  // const [isAuthenticated, setIsAuthenticated] = useState(false); // अब इसकी जरूरत नहीं
  // const [isChecking, setIsChecking] = useState(true); // अब इसकी जरूरत नहीं

  useEffect(() => {
    // ⚡ केवल तब चेक करो जब AuthContext लोडिंग खत्म कर चुका हो
    if (isLoadingAuth) return;

    // यदि authenticated नहीं है या admin नहीं है, तो redirect करें
    if (!isAuthenticated || !isAdmin) {
      console.warn("AdminGuard: User not authenticated or not an admin. Redirecting to /admin-login.");
      navigate("/admin-login", { replace: true });
    }
    // यदि authenticated और admin है, तो कुछ नहीं करें, children render होंगे
    
  }, [isLoadingAuth, isAuthenticated, isAdmin, navigate]); // Dependencies updated

  // ✅ Loading phase: redirect नहीं करना, Loading UI दिखाएं
  //    अब 'isChecking' state की आवश्यकता नहीं है
  if (isLoadingAuth) {
    return <div className="text-center py-10">Loading Admin Panel...</div>; // ✅ className
  }

  // ✅ यदि isAuthenticated और isAdmin दोनों true हैं, तो children render करें
  //    यदि useEffect में redirect हो गया है, तो यह block execute नहीं होगा।
  return <>{children}</>;
};

export default AdminGuard; // ✅ camelCase
*/}
