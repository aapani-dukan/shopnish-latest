// client/src/App.tsx
import { useState, useEffect } from "react"; // ✅ useEffect add kiya
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"; // ✅ useNavigate add kiya

// Layouts and components
import Header from "./components/header";
import CartModal from "./components/cart-modal";
import AdminLayout from "@/components/AdminLayout";
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
import SellerProductsPage from "./pages/SellerProductsPage";
import SellerOrdersPage from "./pages/SellerOrdersPage";
import DeliverySettingsPage from "@/components/seller/DeliverySettingsPage"; 
import SellerAddProductPage from "./pages/SellerAddProductPage"; 
import SellerEditProductPage from "./pages/SellerEditProductPage"; 
import OrderDetailsPage from "./pages/order-details/[id].tsx";
import AdminVendorsPage from "./pages/admin/AdminVendorsPage.tsx";
import AdminDeliveryAreasPage from "./pages/admin/AdminDeliveryAreasPage.tsx";
import AdminWalletManager from './pages/admin/WalletManagement';
import DeliveryWallet from './components/delivery/DeliveryWallet';
import SellerWallet from './components/seller/SellerWallet';
import DeliveryLayout from './components/layout/DeliveryLayout';

import { useAuth } from "./hooks/useAuth.tsx";
import SyncPhonePage from "./components/auth/SyncPhonePage.tsx"; // ✅ Path sahi check kar lena

function App() {
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const { mustSyncPhone, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 🚩 MASTER REDIRECT: Phone missing hai toh sync page pe bhejo
  useEffect(() => {
    if (isAuthenticated && mustSyncPhone && location.pathname !== "/sync-phone") {
      navigate("/sync-phone", { replace: true });
    }
  }, [isAuthenticated, mustSyncPhone, navigate, location.pathname]);

  return (
    <>  
      {/* 1. Header sirf tab dikhao jab phone synced ho */}
      <Header onCartClick={() => setIsCartModalOpen(true)} />
      
      {/* 2. Main content area */}
      <main className={mustSyncPhone ? "w-full h-screen overflow-hidden" : "min-h-screen"}>
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
          
          <Route path="/seller-status" element={<SellerStatusPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          
          {/* ✅ SYNC PHONE PAGE (Isse guard ke bahar rakha hai taaki redirect loop na bane) */}
          <Route path="/sync-phone" element={<SyncPhonePage />} />
          
          <Route element={<AuthRedirectGuard />}> 
            <Route path="/customer/orders" element={<CustomerOrdersPage />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="/track-order/:orderId" element={<TrackOrder />} />
            <Route path="/order-details/:id" element={<OrderDetailsPage />} />
            
            {/* Seller Routes */}
            <Route path="/seller-dashboard" element={<SellerDashboardLayout />}>
              <Route index element={<SellerDashboard />} />
              <Route path="apply" element={<SellerApplyPage />} />
              <Route path="profile/edit" element={<SellerProfileEdit />} />
              <Route path="delivery-settings" element={<DeliverySettingsPage />} />
              <Route path="products" element={<SellerProductsPage />} /> 
              <Route path="products/add" element={<SellerAddProductPage />} />
              <Route path="products/edit/:productId" element={<SellerEditProductPage />} />
              <Route path="orders" element={<SellerOrdersPage />} /> 
              <Route path="wallet" element={<SellerWallet />} />
            </Route>

            {/* Delivery Person Routes */}
            <Route path="/delivery" element={<DeliveryLayout />}>
              <Route index element={<DeliveryDashboard />} />
              <Route path="dashboard" element={<DeliveryDashboard />} />
              <Route path="apply" element={<DeliveryApplyPage />} />
              <Route path="wallet" element={<DeliveryWallet />} />
            </Route>
          </Route>

          {/* ADMIN ROUTES */}
          <Route element={<AdminGuard />}> 
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrderDashboard />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="wallets" element={<AdminWalletManager />} />
              <Route path="vendors" element={<AdminVendorsPage />} />
              <Route path="delivery-areas" element={<AdminDeliveryAreasPage />} />
              <Route path="vendors/:id" element={<AdminVendorDetailsPage />} />
              <Route path="products/:id" element={<AdminProductDetailsPage />} />
              <Route path="categories" element={<CategoriesManagement />} />
            </Route>
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      {/* 3. Global Modals (Only if synced) */}
      {!mustSyncPhone && (
        <CartModal isOpen={isCartModalOpen} onClose={() => setIsCartModalOpen(false)} />
      )}
    </>
  );
}

export default App;