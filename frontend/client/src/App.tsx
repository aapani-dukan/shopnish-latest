// client/src/App.tsx

import React, { useState } from "react"; // Capitalized React, useState
import { Routes, Route } from "react-router-dom"; // Capitalized Routes, Route

// layouts and components
import Header from "./components/header"; // Capitalized Header
import CartModal from "./components/CartModal"; // Capitalized CartModal
import AdminLayout from "./components/AdminLayout"; // Corrected path and Capitalized
// LocationProvider को यहाँ से हटा दिया है क्योंकि यह main.tsx में है
// import { LocationProvider } from "./context/LocationContext"; 
import LocationDisplay from "./components/LocationDisplay"; // <-- LocationDisplay को इम्पोर्ट करें

// pages (Capitalized and corrected paths if necessary)
import HomePage from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import AuthPage from "./pages/Auth";
import SellerDashboard from "./pages/SellerDashboard";
import SellerApplyPage from "./pages/SellerApply";
import SellerStatusPage from "./pages/SellerStatus";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import DeliveryApplyPage from "./pages/DeliveryApply";
import DeliveryLogin from "./pages/DeliveryLogin";
import LoginPage from "./pages/Login";
import CategoriesManagement from "./components/CategoriesManagement"; // This seems to be a component, not a page.
import AdminLogin from "./pages/AdminLogin";
import OrderConfirmation from "./pages/OrderConfirmation";
import CustomerOrdersPage from "./pages/customer/Orders";
import TrackOrder from "./pages/TrackOrder"; 
import Checkout2 from "./pages/Checkout2";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import AdminOrderDashboard from "./pages/AdminOrderDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiesPolicy from "./pages/CookiesPolicy";
import FAQ from "./pages/FAQ";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";

// protected / auth-based
import AuthRedirectGuard from "./components/AuthRedirectGuard"; // Capitalized AuthRedirectGuard
import AdminGuard from "./components/AdminGuard"; // Capitalized AdminGuard

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
