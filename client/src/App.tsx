import { useState } from "react";
import { Routes, Route } from "react-router-dom";

// Layouts and components
import Header from "./components/header";
import CartModal from "./components/cart-modal";
import AdminLayout from "@/components/AdminLayout";

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
import AdminGuard from "@/components/admin-guard";

function App() {
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  return (
      <>  
      <Header onCartClick={() => setIsCartModalOpen(true)} />
      <main className="min-h-screen">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout2/:id" element={<Checkout2 />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/delivery-login" element={<DeliveryLogin />} />
           <Route path="/track-order/:orderId" element={<TrackOrder />} />

      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/cookies-policy" element={<CookiesPolicy />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/contact" element={<ContactUs />} />
          
          {/* Protected routes */}
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
            path="/order-confirmation/:orderId"
            element={
              <AuthRedirectGuard>
                <OrderConfirmation />
              </AuthRedirectGuard>
            }
          />
              <Route 
            path="/track-order/:orderId" 
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
      <CartModal isOpen={isCartModalOpen} onClose={() => setIsCartModalOpen(false)} />
    </>
  );
}

export default App;
