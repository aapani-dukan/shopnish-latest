
// client/src/App.tsx..
import React, { useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom";

// Layouts and components
import Header from "./components/header";
import CartModal from "./components/cart-modal";
import AdminLayout from "@/components/AdminLayout";
import { LocationProvider } from "./context/LocationContext";
import SellerDashboardLayout from "./components/layout/SellerDashboardLayout"; 


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
import AdminDashboard from "@/pages/admin/AdminDashboard";
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
import AdminOrderDashboard from "./pages/admin/AdminOrderDashboard";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import CookiesPolicy from "@/pages/CookiesPolicy";
import FAQ from "@/pages/FAQ";
import AboutUs from "@/pages/AboutUs";
import ContactUs from "@/pages/ContactUs";
// Protected / Auth-based
import AuthRedirectGuard from "@/components/auth-redirect-guard";
import AdminGuard from "@/components/admin-guard";
import AdminVendorDetailsPage from './pages/admin/AdminVendorDetailsPage'; 
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import SellerProfileEdit from '@/components/seller/SellerProfileEdit';
import AdminProductDetailsPage from './pages/admin/AdminProductDetailsPage'; 
//import LocationDisplay from "./components/LocationDisplay"; // <-- LocationDisplay को इम्पोर्ट करें

import DeliverySettingsPage from "@/components/seller/DeliverySettingsPage"; // Capitalized

function App() {
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  return (
    <>  
      {/* Header को यहाँ रेंडर करें, यह सभी रूट्स के लिए कॉमन होगा।
          LocationProvider main.tsx में होने के कारण, Header को LocationContext तक पहुंच होगी। */}
      <Header onCartClick={() => setIsCartModalOpen(true)} />
      
      {/* main content area */}
      <main className="min-h-screen"> 
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout2/:id" element={<Checkout2 />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/delivery-login" element={<DeliveryLogin />} />
          
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />

          {/* PROTECTED ROUTES (Requires Auth) */}
          {/* AuthRedirectGuard एक लेआउट कंपोनेंट की तरह काम करेगा जो चिल्ड्रेन को प्रोटेक्ट करेगा */}
          <Route element={<AuthRedirectGuard />}> 
            {/* Customer Routes */}
            <Route path="/customer/orders" element={<CustomerOrdersPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="/track-order/:orderId" element={<TrackOrder />} />

            {/* Seller Routes (using a shared layout for the dashboard) */}
              <Route path="/seller" element={<SellerDashboardLayout />}>
              <Route index element={<SellerDashboard />} />
              <Route index element={<SellerDashboard />} />
              <Route path="apply" element={<SellerApplyPage />} />
              <Route path="status" element={<SellerStatusPage />} />
              <Route path="profile/edit" element={<SellerProfileEdit />} />
              <Route path="delivery-settings" element={<DeliverySettingsPage />} />
              {/* अन्य सेलर रूट्स यहां जोड़ें */}
            </Route>

            {/* Delivery Person Routes */}
            <Route path="/delivery" element={<DeliveryDashboard />} />
            <Route path="/delivery-apply" element={<DeliveryApplyPage />} />
          </Route>

          {/* ADMIN ROUTES (Requires Admin Guard and AdminLayout) */}
          {/* AdminGuard एक लेआउट कंपोनेंट की तरह काम करेगा जो चिल्ड्रेन को प्रोटेक्ट करेगा */}
          <Route element={<AdminGuard />}> 
            {/* AdminLayout यहां AdminGuard के अंदर नेस्टेड है */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrderDashboard />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="vendors/:id" element={<AdminVendorDetailsPage />} />
              <Route path="products/:id" element={<AdminProductDetailsPage />} />
              <Route path="categories" element={<CategoriesManagement />} />
              {/* अन्य एडमिन रूट्स यहां जोड़ें */}
            </Route>
          </Route>
          
          {/* 404 CATCH-ALL ROUTE (हमेशा अंत में होना चाहिए) */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      {/* GLOBAL MODALS / COMPONENTS */}
      {/* CartModal को यहां रखें ताकि यह सभी पेजों पर फ़्लोट कर सके */}
      <CartModal isOpen={isCartModalOpen} onClose={() => setIsCartModalOpen(false)} />
    </>
  );
}

export default App;
