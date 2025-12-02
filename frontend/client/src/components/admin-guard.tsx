// src/components/admin-guard.tsx
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
