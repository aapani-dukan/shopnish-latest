// client/src/App.tsx

import React, { useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom"; // Outlet इम्पोर्ट करें

// layouts and components
import Header from "./components/header"; // Capitalized
import CartModal from "./components/cart-modal"; // Capitalized
import AdminLayout from "./components/adminlayout"; // Capitalized
import SellerDashboardLayout from "./layouts/SellerDashboardLayout"; // Capitalized, Assuming this exists and has an <Outlet />

// pages
import HomePage from "./pages/home"; // Capitalized
import ProductDetail from "./pages/product-detail"; // Capitalized
import Cart from "./pages/cart"; // Capitalized
import Checkout from "./pages/checkout"; // Capitalized
import AuthPage from "./pages/auth"; // Capitalized
import SellerDashboard from "./pages/seller-dashboard"; // Capitalized
import SellerApplyPage from "./pages/seller-apply"; // Capitalized
import SellerStatusPage from "./pages/seller-status"; // Capitalized
import NotFound from "./pages/not-found"; // Capitalized
import AdminDashboard from "./pages/admin/admindashboard"; // Capitalized
import DeliveryApplyPage from "./pages/delivery-apply"; // Capitalized
import DeliveryLoginPage from "./pages/delivery-login"; // Capitalized
import LoginPage from "./pages/login"; // Capitalized
import CategoriesManagement from "./components/categoriesmanagement"; // Capitalized
import AdminLoginPage from "./pages/admin-login"; // Capitalized
import OrderConfirmation from "./pages/order-confirmation"; // Capitalized
import CustomerOrdersPage from "./pages/customer/orders"; // Capitalized
import TrackOrder from "./pages/track-order"; // Capitalized
import Checkout2 from "./pages/checkout2"; // Capitalized
import DeliveryDashboard from "./pages/deliverydashboard"; // Capitalized
import AdminOrderDashboard from "./pages/admin/adminorderdashboard"; // Capitalized
import PrivacyPolicy from "./pages/privacypolicy"; // Capitalized
import TermsOfService from "./pages/termsofservice"; // Capitalized
import CookiesPolicy from "./pages/cookiespolicy"; // Capitalized
import FAQ from "./pages/faq"; // Capitalized
import AboutUs from "./pages/aboutus"; // Capitalized
import ContactUs from "./pages/contactus"; // Capitalized

// protected / auth-based
import AuthRedirectGuard from "./components/auth-redirect-guard"; // Capitalized
import AdminGuard from "./components/admin-guard"; // Capitalized
import AdminVendorDetailsPage from './pages/admin/adminvendordetailspage'; // Capitalized
import AdminSettingsPage from './pages/admin/adminsettingspage'; // Capitalized
import SellerProfileEdit from './components/seller/sellerprofileedit'; // Capitalized
import AdminProductDetailsPage from './pages/admin/adminproductdetailspage'; // Capitalized
// LocationDisplay को App.tsx में इम्पोर्ट करने की आवश्यकता नहीं है, क्योंकि यह main.tsx के div के अंदर है।
// import LocationDisplay from "./components/locationdisplay"; 
import DeliverySettingsPage from "./pages/seller/DeliverySettingsPage"; // Capitalized

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
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/delivery-login" element={<DeliveryLoginPage />} />
          
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
