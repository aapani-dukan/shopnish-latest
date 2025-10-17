// client/src/App.tsx..
import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";

// Layouts and components
import Header from "./components/header";
import CartModal from "./components/cart-modal";
import AdminLayout from "@/components/AdminLayout";
import { LocationProvider } from "./context/LocationContext
// Pages

import HomePage from "@/pages/home";
import ProductDetail from "@/pages/product-detail";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import AuthPage from "@/pages/auth";
import SellerDashboard from "@/pages/seller-dashboard";
import SellerApplyPage from "@/pages/seller-apply";
import SellerStatusPage from "@/pages/seller-status";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin-dashboard";
import DeliveryApplyPage from "@/pages/delivery-apply";
import DeliveryLogin from "@/pages/delivery-login";
import LoginPage from "@/pages/login";
import CategoriesManagement from "@/components/CategoriesManagement";
import AdminLogin from "@/pages/admin-login";
import OrderConfirmation from "@/pages/order-confirmation";
import CustomerOrdersPage from "@/pages/customer/orders";
import TrackOrder from "@/pages/track-order"; 
import Checkout2 from "./pages/checkout2";
import DeliveryDashboard from "@/pages/DeliveryDashboard";
import AdminOrderDashboard from "./pages/adminOrderDashboard";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import CookiesPolicy from "@/pages/CookiesPolicy";
import FAQ from "@/pages/FAQ";
import AboutUs from "@/pages/AboutUs";
import ContactUs from "@/pages/ContactUs";
// Protected / Auth-based
import AuthRedirectGuard from "@/components/auth-redirect-guard";
import AdminGuard from "@/components/admin-guard",


import AdminLayout from "./components/AdminLayout"; // Corrected path and Capitalized

import LocationDisplay from "./components/LocationDisplay"; // <-- LocationDisplay को इम्पोर्ट करें
function App() { // Capitalized App
  const [isCartModalOpen, setIsCartModalOpen] = useState(false); // Capitalized useState, variables

  return (
    <>  
      {/* Header को यहाँ रेंडर करें, यह LocationDisplay का उपयोग कर सकता है */}
      <Header onCartClick={() => setIsCartModalOpen(true)} /> {/* onCartClick prop name, Capitalized setIsCartModalOpen */}
      
      <main className="min-h-screen"> {/* className, not classname */}
        <Routes> {/* Capitalized Routes */}
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout2/:id" element={<Checkout2 />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/delivery-login" element={<DeliveryLogin />} />
          {/* Note: /track-order/:orderId यहां डुप्लीकेट है, इसे Protected Routes सेक्शन में ही रखें */}
          <Route path="/track-order/:orderId" element={<TrackOrder />} /> {/* orderId, not orderid */}

          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          
          {/* Protected Routes */}
          <Route
            path="/seller-dashboard"
            element={
              <AuthRedirectGuard>
                <SellerDashboard />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/seller-apply"
            element={
              <AuthRedirectGuard>
                <SellerApplyPage />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/seller-status"
            element={
              <AuthRedirectGuard>
                <SellerStatusPage />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/delivery-page"
            element={
              <AuthRedirectGuard>
                <DeliveryDashboard />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/delivery-apply"
            element={
              <AuthRedirectGuard>
                <DeliveryApplyPage />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/customer/orders"
            element={
              <AuthRedirectGuard>
                <CustomerOrdersPage />
              </AuthRedirectGuard>
            }
          />
          <Route
            path="/order-confirmation/:orderId" // orderId, not orderid
            element={
              <AuthRedirectGuard>
                <OrderConfirmation />
              </AuthRedirectGuard>
            }
          />
          {/* यह /track-order/:orderId का सही स्थान है */}
          <Route 
            path="/track-order/:orderId" // orderId, not orderid
            element={
              <AuthRedirectGuard>
                <TrackOrder/>
              </AuthRedirectGuard> 
            } 
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrderDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="categories" element={<CategoriesManagement />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <CartModal isOpen={isCartModalOpen} onClose={() => setIsCartModalOpen(false)} /> {/* isOpen, onClose, Capitalized setIsCartModalOpen */}
    </>
  );
}

export default App;
