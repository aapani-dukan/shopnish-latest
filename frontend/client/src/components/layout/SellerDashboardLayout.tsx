// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet } from 'react-router-dom'; // ✅ Outlet इम्पोर्ट करें
import SellerSidebar from './SellerSidebar'; // ✅ साइडबार इम्पोर्ट करें
import Header from '../header'; // ✅ हेडर को भी इम्पोर्ट करें (यदि आप इसे लेआउट में चाहते हैं)

const SellerDashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 1. हेडर (वैकल्पिक, यदि आप इसे साइडबार के ऊपर चाहते हैं) */}
      <Header />

      <div className="flex flex-1">
        {/* 2. साइडबार (बाएं तरफ) */}
        <SellerSidebar />

        {/* 3. मुख्य सामग्री क्षेत्र (दाएं तरफ) */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* ✅✅✅ महत्वपूर्ण ✅✅✅
             Outlet वह जगह है जहाँ React Router नेस्टेड रूट्स को रेंडर करेगा।
             (जैसे: SellerDashboard, DeliverySettingsPage, आदि)
          */}
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default SellerDashboardLayout;
